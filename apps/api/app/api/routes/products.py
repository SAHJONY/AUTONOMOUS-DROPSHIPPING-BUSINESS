from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app.api.deps import DB, CurrentOrg
from app.models import Product, ProductAnalysis
from app.schemas import (
    ProductAnalysisOut,
    ProductCreate,
    ProductOut,
    ScoreRequest,
    ScoreResponse,
)
from app.services import scoring

router = APIRouter(prefix="/orgs/{org_id}/products", tags=["products"])


@router.get("", response_model=list[ProductOut])
def list_products(org: CurrentOrg, db: DB) -> list[Product]:
    return list(
        db.scalars(
            select(Product).where(Product.org_id == org.id).order_by(Product.created_at.desc())
        )
    )


@router.post("", response_model=ProductOut, status_code=status.HTTP_201_CREATED)
def create_product(body: ProductCreate, org: CurrentOrg, db: DB) -> Product:
    product = Product(org_id=org.id, **body.model_dump())
    db.add(product)
    db.commit()
    db.refresh(product)
    return product


@router.post("/score", response_model=ScoreResponse)
def score_opportunity(body: ScoreRequest, org: CurrentOrg) -> ScoreResponse:
    result = scoring.score_product(
        demand=body.demand,
        competition=body.competition,
        margin=body.margin,
        trend=body.trend,
        risk=body.risk,
    )
    return ScoreResponse(**result.as_dict())


@router.get("/{product_id}", response_model=ProductOut)
def get_product(product_id: str, org: CurrentOrg, db: DB) -> Product:
    product = db.get(Product, product_id)
    if product is None or product.org_id != org.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Product not found")
    return product


@router.get("/{product_id}/analyses", response_model=list[ProductAnalysisOut])
def list_analyses(product_id: str, org: CurrentOrg, db: DB) -> list[ProductAnalysis]:
    product = db.get(Product, product_id)
    if product is None or product.org_id != org.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Product not found")
    return list(
        db.scalars(
            select(ProductAnalysis)
            .where(ProductAnalysis.product_id == product_id)
            .order_by(ProductAnalysis.created_at.desc())
        )
    )
