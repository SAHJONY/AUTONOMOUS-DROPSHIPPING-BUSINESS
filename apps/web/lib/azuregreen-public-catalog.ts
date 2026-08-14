export type AzureGreenPublicCatalogSeed = {
  id: string;
  supplier: "AzureGreen";
  sku: string;
  name: string;
  category: string;
  historicalPublicPriceUsd: number;
  sourcePage: number;
};

export const AZUREGREEN_CATALOG_URL = "https://www.azuregreen.net/PDFs/catalog.pdf";
export const AZUREGREEN_CATALOG_DATE = "2019-12-12";

/**
 * Curated references transcribed from AzureGreen's public PDF catalog.
 * These are discovery leads, not a wholesale quote, stock confirmation, or resale approval.
 */
export const AZUREGREEN_PUBLIC_CATALOG_SEEDS: AzureGreenPublicCatalogSeed[] = [
  { id: "azuregreen-oe1ooch", supplier: "AzureGreen", sku: "OE1OOCH", name: "Aceite Orisha Ochosi 1 oz", category: "Aceites de Orishas", historicalPublicPriceUsd: 8.95, sourcePage: 217 },
  { id: "azuregreen-oe1oele", supplier: "AzureGreen", sku: "OE1OELE", name: "Aceite Orisha Eleguá 1 oz", category: "Aceites de Orishas", historicalPublicPriceUsd: 8.95, sourcePage: 217 },
  { id: "azuregreen-oe1ogu", supplier: "AzureGreen", sku: "OE1OOGU", name: "Aceite Orisha Ogún 1 oz", category: "Aceites de Orishas", historicalPublicPriceUsd: 8.95, sourcePage: 217 },
  { id: "azuregreen-oe1osha", supplier: "AzureGreen", sku: "OE1OOSH", name: "Aceite Orisha Oshún 1 oz", category: "Aceites de Orishas", historicalPublicPriceUsd: 8.95, sourcePage: 217 },
  { id: "azuregreen-oe1yem", supplier: "AzureGreen", sku: "OE1OYEM", name: "Aceite Orisha Yemayá 1 oz", category: "Aceites de Orishas", historicalPublicPriceUsd: 8.95, sourcePage: 217 },
  { id: "azuregreen-oe1ocha", supplier: "AzureGreen", sku: "OE1OCHA", name: "Aceite Orisha Changó 1 oz", category: "Aceites de Orishas", historicalPublicPriceUsd: 8.95, sourcePage: 217 },
  { id: "azuregreen-oe1oru", supplier: "AzureGreen", sku: "OE1OORU", name: "Aceite Orisha Orunla 1 oz", category: "Aceites de Orishas", historicalPublicPriceUsd: 8.95, sourcePage: 217 },
  { id: "azuregreen-oe1osa", supplier: "AzureGreen", sku: "OE1OOSA", name: "Aceite Orisha Osain 1 oz", category: "Aceites de Orishas", historicalPublicPriceUsd: 8.95, sourcePage: 217 },
  { id: "azuregreen-oe1sap", supplier: "AzureGreen", sku: "OE1OSAP", name: "Aceite Siete Potencias Africanas 1 oz", category: "Aceites de Orishas", historicalPublicPriceUsd: 8.95, sourcePage: 217 },
  { id: "azuregreen-oochv", supplier: "AzureGreen", sku: "OOCHV", name: "Aceite Ochún 4 dr", category: "Aceites espirituales", historicalPublicPriceUsd: 3.95, sourcePage: 213 },
  { id: "azuregreen-ooele", supplier: "AzureGreen", sku: "OOELE", name: "Aceite Eleguá 4 dr", category: "Aceites espirituales", historicalPublicPriceUsd: 3.95, sourcePage: 213 },
  { id: "azuregreen-ooguv", supplier: "AzureGreen", sku: "OOGUV", name: "Aceite Ogún 4 dr", category: "Aceites espirituales", historicalPublicPriceUsd: 3.95, sourcePage: 213 },
  { id: "azuregreen-ooshv", supplier: "AzureGreen", sku: "OOSHV", name: "Aceite Oshún 4 dr", category: "Aceites espirituales", historicalPublicPriceUsd: 3.95, sourcePage: 213 },
  { id: "azuregreen-o7afrpv", supplier: "AzureGreen", sku: "O7AFRPV", name: "Aceite Siete Potencias Africanas 4 dr", category: "Aceites espirituales", historicalPublicPriceUsd: 3.95, sourcePage: 213 },
  { id: "azuregreen-rcows", supplier: "AzureGreen", sku: "RCOWS", name: "Caracoles cowrie, juego de 18", category: "Dilogún y suministros rituales", historicalPublicPriceUsd: 4.95, sourcePage: 228 },
  { id: "azuregreen-rcowsb", supplier: "AzureGreen", sku: "RCOWSB", name: "Caracoles cowrie, bolsa de 1 lb", category: "Dilogún y suministros rituales", historicalPublicPriceUsd: 18.95, sourcePage: 228 },
  { id: "azuregreen-rpegg", supplier: "AzureGreen", sku: "RPEGG", name: "Polvo ritual de cáscara de huevo (cascarilla)", category: "Suministros rituales", historicalPublicPriceUsd: 1.05, sourcePage: 229 },
  { id: "azuregreen-rflo7", supplier: "AzureGreen", sku: "RFLO7", name: "Agua Florida 7.5 oz", category: "Aguas y baños espirituales", historicalPublicPriceUsd: 11.95, sourcePage: 258 },
  { id: "azuregreen-rblas", supplier: "AzureGreen", sku: "RBLAS", name: "Sal negra ritual 1 oz", category: "Suministros rituales", historicalPublicPriceUsd: 2.95, sourcePage: 228 },
  { id: "azuregreen-rfhig", supplier: "AzureGreen", sku: "RFHIG", name: "Polvo para piso High John 4 oz", category: "Limpiezas espirituales", historicalPublicPriceUsd: 3.95, sourcePage: 229 }
];
