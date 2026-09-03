import "dotenv/config"
import { PrismaClient } from "../src/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { CreditorType, PaymentMethodType } from "../src/lib/database-enums"

const url = process.env.DIRECT_URL || process.env.DATABASE_URL!
const adapter = new PrismaPg({ connectionString: url })
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log("Seeding catalogs...")

  const catalogs = [
    { type: "TIPO_ARTICULO", value: "MP", description: "Materia prima" },
    { type: "TIPO_ARTICULO", value: "IN", description: "Insumo / envase" },
    { type: "TIPO_ARTICULO", value: "SE", description: "Semielaborado" },
    { type: "TIPO_ARTICULO", value: "PT", description: "Producto terminado" },
    { type: "TIPO_ARTICULO", value: "RV", description: "Reventa" },

    { type: "SECCION", value: "Panadería", description: "Área de panadería" },
    { type: "SECCION", value: "Pastelería/Obrador", description: "Área de pastelería y obrador" },
    { type: "SECCION", value: "Salados", description: "Área de salados" },
    { type: "SECCION", value: "Cafetería", description: "Área de cafetería" },
    { type: "SECCION", value: "Reventa", description: "Productos de reventa" },
    { type: "SECCION", value: "General", description: "Uso general" },

    { type: "FAMILIA", value: "Harinas y sémolas", codePrefix: "HAR", description: "Harinas, sémolas y cereales" },
    { type: "FAMILIA", value: "Levaduras y mejorantes", codePrefix: "LEV", description: "Levaduras, mejorantes y premezclas" },
    { type: "FAMILIA", value: "Azúcares y edulcorantes", codePrefix: "AZU", description: "Azúcares, miel, edulcorantes" },
    { type: "FAMILIA", value: "Grasas y aceites", codePrefix: "GRA", description: "Mantequilla, margarina, aceites" },
    { type: "FAMILIA", value: "Lácteos y huevos", codePrefix: "LAC", description: "Leche, nata, queso, huevo" },
    { type: "FAMILIA", value: "Frutas y frutos secos", codePrefix: "FRU", description: "Fruta fresca, frutos secos, confitura" },
    { type: "FAMILIA", value: "Chocolates y coberturas", codePrefix: "CHO", description: "Chocolate, coberturas, cacao" },
    { type: "FAMILIA", value: "Aditivos y aromas", codePrefix: "ADI", description: "Colorantes, aromas, gelificantes" },
    { type: "FAMILIA", value: "Sal y especias", codePrefix: "SAL", description: "Sal, pimienta, especias" },
    { type: "FAMILIA", value: "Envases y embalajes", codePrefix: "ENV", description: "Bolsas, cajas, bandejas, etiquetas" },
    { type: "FAMILIA", value: "Consumibles y limpieza", codePrefix: "LIM", description: "Productos de limpieza y consumibles" },
    { type: "FAMILIA", value: "Pan", codePrefix: "PAN", description: "Panes y variaciones" },
    { type: "FAMILIA", value: "Bollería", codePrefix: "BOL", description: "Croissants, napolitanas, magdalenas" },
    { type: "FAMILIA", value: "Pastelería", codePrefix: "PAS", description: "Pastelería en general" },
    { type: "FAMILIA", value: "Tartas", codePrefix: "TAR", description: "Tartas enteras y porciones" },
    { type: "FAMILIA", value: "Salados", codePrefix: "SLD", description: "Empanadas, bocadillos, etc." },
    { type: "FAMILIA", value: "Bebidas", codePrefix: "BEB", description: "Agua, refrescos, zumos" },
    { type: "FAMILIA", value: "Cafetería", codePrefix: "CAF", description: "Café y productos de cafetería" },
    { type: "FAMILIA", value: "Semielaborados", codePrefix: "SEM", description: "Masas, cremas, bizcochos del obrador" },

    { type: "SUBFAMILIA", value: "Trigo", description: "Harinas de trigo" },
    { type: "SUBFAMILIA", value: "Integral / especiales", description: "Harinas integrales y especiales" },
    { type: "SUBFAMILIA", value: "Sin gluten", description: "Harinas y productos sin gluten" },
    { type: "SUBFAMILIA", value: "Levadura", description: "Levadura fresca y seca" },
    { type: "SUBFAMILIA", value: "Mejorante", description: "Mejorantes para masa" },
    { type: "SUBFAMILIA", value: "Azúcar", description: "Azúcar blanca, morena" },
    { type: "SUBFAMILIA", value: "Mantequilla", description: "Mantequilla de vaca" },
    { type: "SUBFAMILIA", value: "Margarina", description: "Margarinas técnicas" },
    { type: "SUBFAMILIA", value: "Aceite", description: "Aceites de oliva, girasol" },
    { type: "SUBFAMILIA", value: "Leche", description: "Leche entera, desnatada" },
    { type: "SUBFAMILIA", value: "Nata", description: "Nata para montar y cocinar" },
    { type: "SUBFAMILIA", value: "Queso", description: "Quesos varios" },
    { type: "SUBFAMILIA", value: "Huevo", description: "Huevo fresco y líquido" },
    { type: "SUBFAMILIA", value: "Fruta fresca", description: "Frutas de temporada" },
    { type: "SUBFAMILIA", value: "Frutos secos", description: "Frutos secos variados" },
    { type: "SUBFAMILIA", value: "Confitura", description: "Mermeladas y confituras" },
    { type: "SUBFAMILIA", value: "Cobertura", description: "Coberturas de chocolate" },
    { type: "SUBFAMILIA", value: "Cacao", description: "Cacao en polvo" },
    { type: "SUBFAMILIA", value: "Colorantes y aromas", description: "Colorantes y extractos aromáticos" },
    { type: "SUBFAMILIA", value: "Gelificantes", description: "Gelatina, agar, pectina" },
    { type: "SUBFAMILIA", value: "Bolsas y papel", description: "Bolsas de papel y celofán" },
    { type: "SUBFAMILIA", value: "Cajas", description: "Cajas de cartón y presentación" },
    { type: "SUBFAMILIA", value: "Bandejas", description: "Bandejas de cartón y plástico" },
    { type: "SUBFAMILIA", value: "Etiquetas", description: "Etiquetas de ingredientes y precio" },
    { type: "SUBFAMILIA", value: "Barra", description: "Barras de pan" },
    { type: "SUBFAMILIA", value: "Hogaza", description: "Hogazas y panes redondos" },
    { type: "SUBFAMILIA", value: "Chapata", description: "Chapatas y pianos" },
    { type: "SUBFAMILIA", value: "Pan de molde", description: "Pan de molde y tostado" },
    { type: "SUBFAMILIA", value: "Pan especial", description: "Panes especiales (sin gluten, integral)" },
    { type: "SUBFAMILIA", value: "Croissantería", description: "Croissants y bollería hojaldrada" },
    { type: "SUBFAMILIA", value: "Magdalenas y muffins", description: "Magdalenas y muffins" },
    { type: "SUBFAMILIA", value: "Donuts", description: "Donuts y rosquillas" },
    { type: "SUBFAMILIA", value: "Hojaldre", description: "Palmeras, hojaldres" },
    { type: "SUBFAMILIA", value: "Pastel individual", description: "Pasteles individuales" },
    { type: "SUBFAMILIA", value: "Tarta entera", description: "Tartas enteras" },
    { type: "SUBFAMILIA", value: "Tarta por porción", description: "Tartas porciones" },
    { type: "SUBFAMILIA", value: "Galletas", description: "Galletas artesanas" },
    { type: "SUBFAMILIA", value: "Empanadas", description: "Empanadas y bordados" },
    { type: "SUBFAMILIA", value: "Bocadillos", description: "Bocadillos y sandwiches" },
    { type: "SUBFAMILIA", value: "Masas", description: "Masas base del obrador" },
    { type: "SUBFAMILIA", value: "Cremas y rellenos", description: "Cremas pasteleras y rellenos" },
    { type: "SUBFAMILIA", value: "Bizcochos", description: "Bizcochos y genoveses" },
    { type: "SUBFAMILIA", value: "Almíbares", description: "Almíbares y siropes" },
    { type: "SUBFAMILIA", value: "Café", description: "Café en grano, molido, capsulas" },
    { type: "SUBFAMILIA", value: "Refrescos", description: "Refrescos y bebidas azucaradas" },
    { type: "SUBFAMILIA", value: "Agua y zumos", description: "Agua mineral y zumos naturales" },
    { type: "SUBFAMILIA", value: "Otros", description: "Otros productos" },

    { type: "UNIDAD_MEDIDA", value: "kg", description: "Kilogramos" },
    { type: "UNIDAD_MEDIDA", value: "g", description: "Gramos" },
    { type: "UNIDAD_MEDIDA", value: "l", description: "Litros" },
    { type: "UNIDAD_MEDIDA", value: "ml", description: "Mililitros" },
    { type: "UNIDAD_MEDIDA", value: "ud", description: "Unidades" },
    { type: "UNIDAD_MEDIDA", value: "docena", description: "Docenas" },
    { type: "UNIDAD_MEDIDA", value: "bandeja", description: "Bandejas" },
    { type: "UNIDAD_MEDIDA", value: "caja", description: "Cajas" },
    { type: "UNIDAD_MEDIDA", value: "saco", description: "Sacos" },
    { type: "UNIDAD_MEDIDA", value: "bote", description: "Botes" },
    { type: "UNIDAD_MEDIDA", value: "paquete", description: "Paquetes" },
    { type: "UNIDAD_MEDIDA", value: "porción", description: "Porciones" },
    { type: "UNIDAD_MEDIDA", value: "m", description: "Metros" },

    { type: "SI_NO", value: "SI", description: "Sí" },
    { type: "SI_NO", value: "NO", description: "No" },

    { type: "VALORACION", value: "PMP", description: "Precio medio ponderado" },
    { type: "VALORACION", value: "FIFO", description: "First In, First Out" },

    { type: "METODO_PRECIO", value: "MARGEN", description: "Precio calculado desde margen objetivo" },
    { type: "METODO_PRECIO", value: "FIJO", description: "Precio fijado por el negocio" },

    { type: "CLASE_ABC", value: "A", description: "Alto valor, conteo semanal" },
    { type: "CLASE_ABC", value: "B", description: "Valor medio, conteo quincenal" },
    { type: "CLASE_ABC", value: "C", description: "Bajo valor, conteo mensual" },

    { type: "UBICACION", value: "Almacén seco", description: "Almacén de productos secos" },
    { type: "UBICACION", value: "Cámara refrigeración", description: "Cámara de refrigeración" },
    { type: "UBICACION", value: "Congelador", description: "Congelador" },
    { type: "UBICACION", value: "Obrador", description: "Zona de producción" },
    { type: "UBICACION", value: "Tienda / vitrina", description: "Zona de venta al público" },
    { type: "UBICACION", value: "Trastienda", description: "Almacén trasero" },
    { type: "UBICACION", value: "Sin ubicación", description: "Sin ubicación asignada" },

    { type: "CONSERVACION", value: "Ambiente", description: "Temperatura ambiente" },
    { type: "CONSERVACION", value: "Refrigerado (0-4 C)", description: "Refrigeración entre 0 y 4°C" },
    { type: "CONSERVACION", value: "Congelado (-18 C)", description: "Congelación a -18°C" },
    { type: "CONSERVACION", value: "Seco y ventilado", description: "Almacén seco con ventilación" },

    { type: "ESTADO", value: "Activo", description: "Artículo activo en catálogo" },
    { type: "ESTADO", value: "Inactivo", description: "Artículo temporalmente deshabilitado" },
    { type: "ESTADO", value: "Descatalogado", description: "Artículo dado de baja definitiva" },

    { type: "CODIGO_IVA", value: "SR4", description: "Superreducido 4% — Pan, harinas, leche, huevos" },
    { type: "CODIGO_IVA", value: "RD10", description: "Reducido 10% — Bollería, pastelería, hostelería" },
    { type: "CODIGO_IVA", value: "GN21", description: "General 21% — Bebidas alcohólicas, material no alimentario" },
    { type: "CODIGO_IVA", value: "EX0", description: "Exento / no sujeto" },

    { type: "ALERGENO", value: "Gluten", description: "Trigo, cebada, centeno, avena" },
    { type: "ALERGENO", value: "Crustáceos", description: "Cangrejos, gambas, langostinos" },
    { type: "ALERGENO", value: "Huevos", description: "Huevos de gallina" },
    { type: "ALERGENO", value: "Pescado", description: "Pescados y derivados" },
    { type: "ALERGENO", value: "Cacahuetes", description: "Cacahuetes y cacahuete" },
    { type: "ALERGENO", value: "Soja", description: "Soja y derivados" },
    { type: "ALERGENO", value: "Leche", description: "Leche y derivados (lactosa)" },
    { type: "ALERGENO", value: "Frutos de cáscara", description: "Almendras, avellanas, nueces" },
    { type: "ALERGENO", value: "Apio", description: "Apio y derivados" },
    { type: "ALERGENO", value: "Mostaza", description: "Mostaza y derivados" },
    { type: "ALERGENO", value: "Sésamo", description: "Sésamo y derivados" },
    { type: "ALERGENO", value: "Sulfitos", description: "Sulfitos en concentración >10mg/kg" },
    { type: "ALERGENO", value: "Altramuces", description: "Altramuces y derivados" },
    { type: "ALERGENO", value: "Moluscos", description: "Moluscos y derivados" },  ]

  for (const catalog of catalogs) {
    await prisma.catalog.upsert({
      where: { type_value: { type: catalog.type, value: catalog.value } },
      update: {
        description: catalog.description,
        ...(catalog.type === "FAMILIA" ? { codePrefix: catalog.codePrefix } : {}),
      },
      create: catalog,
    })
  }

  console.log(`  ${catalogs.length} catalogs inserted or updated`)

  // Example products are retained as historical reference but are no longer seeded.
  /*
  const exampleProducts = [
    {
      code: "MP-HAR-001", itemType: "MP", posDescription: "Harina trigo W180", fullDescription: "Harina trigo W180 saco 25 kg",
      family: "Harinas y sémolas", subfamily: "Trigo", section: "General", isPurchasable: true, isPrepared: false, isSellable: false, hasRecipe: false,
      baseStockUnit: "kg", purchaseUnit: "saco", purchaseToBaseFactor: 25, salesUnit: null, salesToBaseFactor: null, netWeightPerUnitGrams: null, presentationFormat: "Saco 25 kg",
      baseUnitCost: 0.74, standardWastePercentage: 1.0,
      vatCode: "SR4", vatPercentage: 4, pricingMethod: "MARGEN", targetMarginPercentage: null, targetRetailPriceIncludingVat: null, fixedRetailPriceIncludingVat: null, appliedRetailPriceIncludingVat: null, appliedRetailPriceExcludingVat: null, actualMarginPercentage: null, percentagePointDeviation: null, unitDifference: null, pricingDiagnosis: null,
      stockControl: "SI", valuationMethod: "PMP", minimumStock: 50, maximumStock: 300, reorderPoint: 100, location: "Almacén seco", abcClass: "A",
      batchControl: "SI", shelfLifeDays: 180, storageConditions: "Seco y ventilado", allergens: "Gluten",
      status: "Activo", isExample: true,
    },
    {
      code: "MP-HAR-002", itemType: "MP", posDescription: "Harina fuerza W300", fullDescription: "Harina de fuerza W300 saco 25 kg",
      family: "Harinas y sémolas", subfamily: "Trigo", section: "General", isPurchasable: true, isPrepared: false, isSellable: false, hasRecipe: false,
      baseStockUnit: "kg", purchaseUnit: "saco", purchaseToBaseFactor: 25, salesUnit: null, salesToBaseFactor: null, netWeightPerUnitGrams: null, presentationFormat: "Saco 25 kg",
      baseUnitCost: 0.88, standardWastePercentage: 1.0,
      vatCode: "SR4", vatPercentage: 4, pricingMethod: "MARGEN", targetMarginPercentage: null, targetRetailPriceIncludingVat: null, fixedRetailPriceIncludingVat: null, appliedRetailPriceIncludingVat: null, appliedRetailPriceExcludingVat: null, actualMarginPercentage: null, percentagePointDeviation: null, unitDifference: null, pricingDiagnosis: null,
      stockControl: "SI", valuationMethod: "PMP", minimumStock: 50, maximumStock: 200, reorderPoint: 80, location: "Almacén seco", abcClass: "A",
      batchControl: "SI", shelfLifeDays: 180, storageConditions: "Seco y ventilado", allergens: "Gluten",
      status: "Activo", isExample: true,
    },
    {
      code: "MP-LEV-001", itemType: "MP", posDescription: "Levadura fresca", fullDescription: "Levadura fresca panadero 1 kg",
      family: "Levaduras y mejorantes", subfamily: "Levadura", section: "General", isPurchasable: true, isPrepared: false, isSellable: false, hasRecipe: false,
      baseStockUnit: "kg", purchaseUnit: "paquete", purchaseToBaseFactor: 1, salesUnit: null, salesToBaseFactor: null, netWeightPerUnitGrams: null, presentationFormat: "Paquete 1 kg",
      baseUnitCost: 3.20, standardWastePercentage: 0.5,
      vatCode: "SR4", vatPercentage: 4, pricingMethod: "MARGEN", targetMarginPercentage: null, targetRetailPriceIncludingVat: null, fixedRetailPriceIncludingVat: null, appliedRetailPriceIncludingVat: null, appliedRetailPriceExcludingVat: null, actualMarginPercentage: null, percentagePointDeviation: null, unitDifference: null, pricingDiagnosis: null,
      stockControl: "SI", valuationMethod: "PMP", minimumStock: 5, maximumStock: 20, reorderPoint: 10, location: "Cámara refrigeración", abcClass: "B",
      batchControl: "SI", shelfLifeDays: 14, storageConditions: "Refrigerado (0-4 C)", allergens: null,
      status: "Activo", isExample: true,
    },
    {
      code: "MP-SAL-001", itemType: "MP", posDescription: "Sal marina fina", fullDescription: "Sal marina fina saco 25 kg",
      family: "Sal y especias", subfamily: null, section: "General", isPurchasable: true, isPrepared: false, isSellable: false, hasRecipe: false,
      baseStockUnit: "kg", purchaseUnit: "saco", purchaseToBaseFactor: 25, salesUnit: null, salesToBaseFactor: null, netWeightPerUnitGrams: null, presentationFormat: "Saco 25 kg",
      baseUnitCost: 0.48, standardWastePercentage: 0,
      vatCode: "SR4", vatPercentage: 4, pricingMethod: "MARGEN", targetMarginPercentage: null, targetRetailPriceIncludingVat: null, fixedRetailPriceIncludingVat: null, appliedRetailPriceIncludingVat: null, appliedRetailPriceExcludingVat: null, actualMarginPercentage: null, percentagePointDeviation: null, unitDifference: null, pricingDiagnosis: null,
      stockControl: "SI", valuationMethod: "PMP", minimumStock: 5, maximumStock: 30, reorderPoint: 10, location: "Almacén seco", abcClass: "C",
      batchControl: "NO", shelfLifeDays: null, storageConditions: "Seco y ventilado", allergens: null,
      status: "Activo", isExample: true,
    },
    {
      code: "MP-AZU-001", itemType: "MP", posDescription: "Azúcar blanquilla", fullDescription: "Azúcar blanquilla saco 25 kg",
      family: "Azúcares y edulcorantes", subfamily: "Azúcar", section: "General", isPurchasable: true, isPrepared: false, isSellable: false, hasRecipe: false,
      baseStockUnit: "kg", purchaseUnit: "saco", purchaseToBaseFactor: 25, salesUnit: null, salesToBaseFactor: null, netWeightPerUnitGrams: null, presentationFormat: "Saco 25 kg",
      baseUnitCost: 0.66, standardWastePercentage: 0,
      vatCode: "SR4", vatPercentage: 4, pricingMethod: "MARGEN", targetMarginPercentage: null, targetRetailPriceIncludingVat: null, fixedRetailPriceIncludingVat: null, appliedRetailPriceIncludingVat: null, appliedRetailPriceExcludingVat: null, actualMarginPercentage: null, percentagePointDeviation: null, unitDifference: null, pricingDiagnosis: null,
      stockControl: "SI", valuationMethod: "PMP", minimumStock: 10, maximumStock: 50, reorderPoint: 20, location: "Almacén seco", abcClass: "B",
      batchControl: "NO", shelfLifeDays: null, storageConditions: "Seco y ventilado", allergens: null,
      status: "Activo", isExample: true,
    },
    {
      code: "MP-GRA-001", itemType: "MP", posDescription: "Mantequilla 82%", fullDescription: "Mantequilla 82% MG barra 250 g",
      family: "Grasas y aceites", subfamily: "Mantequilla", section: "General", isPurchasable: true, isPrepared: false, isSellable: false, hasRecipe: false,
      baseStockUnit: "kg", purchaseUnit: "paquete", purchaseToBaseFactor: 1, salesUnit: null, salesToBaseFactor: null, netWeightPerUnitGrams: null, presentationFormat: "Barra 250 g (pack de 4)",
      baseUnitCost: 5.80, standardWastePercentage: 0.5,
      vatCode: "SR4", vatPercentage: 4, pricingMethod: "MARGEN", targetMarginPercentage: null, targetRetailPriceIncludingVat: null, fixedRetailPriceIncludingVat: null, appliedRetailPriceIncludingVat: null, appliedRetailPriceExcludingVat: null, actualMarginPercentage: null, percentagePointDeviation: null, unitDifference: null, pricingDiagnosis: null,
      stockControl: "SI", valuationMethod: "FIFO", minimumStock: 10, maximumStock: 50, reorderPoint: 20, location: "Cámara refrigeración", abcClass: "A",
      batchControl: "SI", shelfLifeDays: 60, storageConditions: "Refrigerado (0-4 C)", allergens: "Leche",
      status: "Activo", isExample: true,
    },
    {
      code: "MP-GRA-002", itemType: "MP", posDescription: "Margarina hojaldre", fullDescription: "Margarina hojaldre técnica 1 kg",
      family: "Grasas y aceites", subfamily: "Margarina", section: "General", isPurchasable: true, isPrepared: false, isSellable: false, hasRecipe: false,
      baseStockUnit: "kg", purchaseUnit: "paquete", purchaseToBaseFactor: 1, salesUnit: null, salesToBaseFactor: null, netWeightPerUnitGrams: null, presentationFormat: "Barra 1 kg",
      baseUnitCost: 3.90, standardWastePercentage: 0,
      vatCode: "SR4", vatPercentage: 4, pricingMethod: "MARGEN", targetMarginPercentage: null, targetRetailPriceIncludingVat: null, fixedRetailPriceIncludingVat: null, appliedRetailPriceIncludingVat: null, appliedRetailPriceExcludingVat: null, actualMarginPercentage: null, percentagePointDeviation: null, unitDifference: null, pricingDiagnosis: null,
      stockControl: "SI", valuationMethod: "FIFO", minimumStock: 10, maximumStock: 40, reorderPoint: 15, location: "Cámara refrigeración", abcClass: "B",
      batchControl: "SI", shelfLifeDays: 90, storageConditions: "Refrigerado (0-4 C)", allergens: null,
      status: "Activo", isExample: true,
    },
    {
      code: "MP-LAC-001", itemType: "MP", posDescription: "Leche entera UHT", fullDescription: "Leche entera UHT brick 1 l",
      family: "Lácteos y huevos", subfamily: "Leche", section: "General", isPurchasable: true, isPrepared: false, isSellable: false, hasRecipe: false,
      baseStockUnit: "l", purchaseUnit: "caja", purchaseToBaseFactor: 12, salesUnit: null, salesToBaseFactor: null, netWeightPerUnitGrams: null, presentationFormat: "Caja 12 × 1 l",
      baseUnitCost: 0.85, standardWastePercentage: 0,
      vatCode: "SR4", vatPercentage: 4, pricingMethod: "MARGEN", targetMarginPercentage: null, targetRetailPriceIncludingVat: null, fixedRetailPriceIncludingVat: null, appliedRetailPriceIncludingVat: null, appliedRetailPriceExcludingVat: null, actualMarginPercentage: null, percentagePointDeviation: null, unitDifference: null, pricingDiagnosis: null,
      stockControl: "SI", valuationMethod: "PMP", minimumStock: 12, maximumStock: 48, reorderPoint: 24, location: "Almacén seco", abcClass: "B",
      batchControl: "SI", shelfLifeDays: 180, storageConditions: "Seco y ventilado", allergens: "Leche",
      status: "Activo", isExample: true,
    },
    {
      code: "MP-LAC-002", itemType: "MP", posDescription: "Nata 35% MG", fullDescription: "Nata para montar 35% MG brick 1 l",
      family: "Lácteos y huevos", subfamily: "Nata", section: "General", isPurchasable: true, isPrepared: false, isSellable: false, hasRecipe: false,
      baseStockUnit: "l", purchaseUnit: "caja", purchaseToBaseFactor: 12, salesUnit: null, salesToBaseFactor: null, netWeightPerUnitGrams: null, presentationFormat: "Caja 12 × 1 l",
      baseUnitCost: 2.10, standardWastePercentage: 0.5,
      vatCode: "SR4", vatPercentage: 4, pricingMethod: "MARGEN", targetMarginPercentage: null, targetRetailPriceIncludingVat: null, fixedRetailPriceIncludingVat: null, appliedRetailPriceIncludingVat: null, appliedRetailPriceExcludingVat: null, actualMarginPercentage: null, percentagePointDeviation: null, unitDifference: null, pricingDiagnosis: null,
      stockControl: "SI", valuationMethod: "FIFO", minimumStock: 6, maximumStock: 24, reorderPoint: 12, location: "Cámara refrigeración", abcClass: "A",
      batchControl: "SI", shelfLifeDays: 30, storageConditions: "Refrigerado (0-4 C)", allergens: "Leche",
      status: "Activo", isExample: true,
    },
    {
      code: "MP-LAC-003", itemType: "MP", posDescription: "Huevo líquido past.", fullDescription: "Huevo líquido pasteurizado 1 kg",
      family: "Lácteos y huevos", subfamily: "Huevo", section: "General", isPurchasable: true, isPrepared: false, isSellable: false, hasRecipe: false,
      baseStockUnit: "kg", purchaseUnit: "caja", purchaseToBaseFactor: 6, salesUnit: null, salesToBaseFactor: null, netWeightPerUnitGrams: null, presentationFormat: "Caja 6 × 1 kg",
      baseUnitCost: 3.50, standardWastePercentage: 0,
      vatCode: "SR4", vatPercentage: 4, pricingMethod: "MARGEN", targetMarginPercentage: null, targetRetailPriceIncludingVat: null, fixedRetailPriceIncludingVat: null, appliedRetailPriceIncludingVat: null, appliedRetailPriceExcludingVat: null, actualMarginPercentage: null, percentagePointDeviation: null, unitDifference: null, pricingDiagnosis: null,
      stockControl: "SI", valuationMethod: "FIFO", minimumStock: 6, maximumStock: 18, reorderPoint: 8, location: "Cámara refrigeración", abcClass: "B",
      batchControl: "SI", shelfLifeDays: 14, storageConditions: "Refrigerado (0-4 C)", allergens: "Huevos",
      status: "Activo", isExample: true,
    },
    {
      code: "MP-CHO-001", itemType: "MP", posDescription: "Cobertura negra 55%", fullDescription: "Cobertura negra 55% cacao 5 kg",
      family: "Chocolates y coberturas", subfamily: "Cobertura", section: "General", isPurchasable: true, isPrepared: false, isSellable: false, hasRecipe: false,
      baseStockUnit: "kg", purchaseUnit: "paquete", purchaseToBaseFactor: 5, salesUnit: null, salesToBaseFactor: null, netWeightPerUnitGrams: null, presentationFormat: "Tableta 5 kg",
      baseUnitCost: 8.90, standardWastePercentage: 1.0,
      vatCode: "RD10", vatPercentage: 10, pricingMethod: "MARGEN", targetMarginPercentage: null, targetRetailPriceIncludingVat: null, fixedRetailPriceIncludingVat: null, appliedRetailPriceIncludingVat: null, appliedRetailPriceExcludingVat: null, actualMarginPercentage: null, percentagePointDeviation: null, unitDifference: null, pricingDiagnosis: null,
      stockControl: "SI", valuationMethod: "FIFO", minimumStock: 5, maximumStock: 20, reorderPoint: 8, location: "Almacén seco", abcClass: "A",
      batchControl: "SI", shelfLifeDays: 365, storageConditions: "Seco y ventilado", allergens: "Leche",
      status: "Activo", isExample: true,
    },
    {
      code: "MP-FRU-001", itemType: "MP", posDescription: "Almendra molida", fullDescription: "Almendra molida 500 g",
      family: "Frutas y frutos secos", subfamily: "Frutos secos", section: "General", isPurchasable: true, isPrepared: false, isSellable: false, hasRecipe: false,
      baseStockUnit: "kg", purchaseUnit: "paquete", purchaseToBaseFactor: 1, salesUnit: null, salesToBaseFactor: null, netWeightPerUnitGrams: null, presentationFormat: "Bolsa 500 g",
      baseUnitCost: 9.50, standardWastePercentage: 0,
      vatCode: "RD10", vatPercentage: 10, pricingMethod: "MARGEN", targetMarginPercentage: null, targetRetailPriceIncludingVat: null, fixedRetailPriceIncludingVat: null, appliedRetailPriceIncludingVat: null, appliedRetailPriceExcludingVat: null, actualMarginPercentage: null, percentagePointDeviation: null, unitDifference: null, pricingDiagnosis: null,
      stockControl: "SI", valuationMethod: "FIFO", minimumStock: 2, maximumStock: 10, reorderPoint: 4, location: "Almacén seco", abcClass: "B",
      batchControl: "SI", shelfLifeDays: 180, storageConditions: "Seco y ventilado", allergens: "Frutos de cáscara",
      status: "Activo", isExample: true,
    },
    {
      code: "IN-ENV-001", itemType: "IN", posDescription: "Bolsa papel antigrasa", fullDescription: "Bolsa papel antigrasa 20×30 cm",
      family: "Envases y embalajes", subfamily: "Bolsas y papel", section: "General", isPurchasable: true, isPrepared: false, isSellable: false, hasRecipe: false,
      baseStockUnit: "ud", purchaseUnit: "paquete", purchaseToBaseFactor: 500, salesUnit: null, salesToBaseFactor: null, netWeightPerUnitGrams: null, presentationFormat: "Paquete 500 unidades",
      baseUnitCost: 0.024, standardWastePercentage: 2.0,
      vatCode: "RD10", vatPercentage: 10, pricingMethod: "MARGEN", targetMarginPercentage: null, targetRetailPriceIncludingVat: null, fixedRetailPriceIncludingVat: null, appliedRetailPriceIncludingVat: null, appliedRetailPriceExcludingVat: null, actualMarginPercentage: null, percentagePointDeviation: null, unitDifference: null, pricingDiagnosis: null,
      stockControl: "SI", valuationMethod: "PMP", minimumStock: 500, maximumStock: 2000, reorderPoint: 800, location: "Trastienda", abcClass: "C",
      batchControl: "NO", shelfLifeDays: null, storageConditions: "Seco y ventilado", allergens: null,
      status: "Activo", isExample: true,
    },
    {
      code: "IN-ENV-002", itemType: "IN", posDescription: "Caja tarta 26 cm", fullDescription: "Caja tarta redonda 26 cm cartón",
      family: "Envases y embalajes", subfamily: "Cajas", section: "General", isPurchasable: true, isPrepared: false, isSellable: false, hasRecipe: false,
      baseStockUnit: "ud", purchaseUnit: "paquete", purchaseToBaseFactor: 50, salesUnit: null, salesToBaseFactor: null, netWeightPerUnitGrams: null, presentationFormat: "Paquete 50 unidades",
      baseUnitCost: 0.45, standardWastePercentage: 0,
      vatCode: "RD10", vatPercentage: 10, pricingMethod: "MARGEN", targetMarginPercentage: null, targetRetailPriceIncludingVat: null, fixedRetailPriceIncludingVat: null, appliedRetailPriceIncludingVat: null, appliedRetailPriceExcludingVat: null, actualMarginPercentage: null, percentagePointDeviation: null, unitDifference: null, pricingDiagnosis: null,
      stockControl: "SI", valuationMethod: "PMP", minimumStock: 50, maximumStock: 300, reorderPoint: 100, location: "Trastienda", abcClass: "C",
      batchControl: "NO", shelfLifeDays: null, storageConditions: "Seco y ventilado", allergens: null,
      status: "Activo", isExample: true,
    },
    {
      code: "IN-ENV-003", itemType: "IN", posDescription: "Etiqueta ingredientes", fullDescription: "Etiqueta ingredientes autoadhesiva",
      family: "Envases y embalajes", subfamily: "Etiquetas", section: "General", isPurchasable: true, isPrepared: false, isSellable: false, hasRecipe: false,
      baseStockUnit: "ud", purchaseUnit: "paquete", purchaseToBaseFactor: 1000, salesUnit: null, salesToBaseFactor: null, netWeightPerUnitGrams: null, presentationFormat: "Rollo 1000 etiquetas",
      baseUnitCost: 0.008, standardWastePercentage: 3.0,
      vatCode: "RD10", vatPercentage: 10, pricingMethod: "MARGEN", targetMarginPercentage: null, targetRetailPriceIncludingVat: null, fixedRetailPriceIncludingVat: null, appliedRetailPriceIncludingVat: null, appliedRetailPriceExcludingVat: null, actualMarginPercentage: null, percentagePointDeviation: null, unitDifference: null, pricingDiagnosis: null,
      stockControl: "SI", valuationMethod: "PMP", minimumStock: 200, maximumStock: 2000, reorderPoint: 500, location: "Trastienda", abcClass: "C",
      batchControl: "NO", shelfLifeDays: null, storageConditions: "Seco y ventilado", allergens: null,
      status: "Activo", isExample: true,
    },
    {
      code: "SE-SEM-001", itemType: "SE", posDescription: "Masa madre líquida", fullDescription: "Masa madre líquida de levadura",
      family: "Semielaborados", subfamily: "Masas", section: "Pastelería/Obrador", isPurchasable: false, isPrepared: true, isSellable: false, hasRecipe: true,
      baseStockUnit: "kg", purchaseUnit: null, purchaseToBaseFactor: null, salesUnit: null, salesToBaseFactor: null, netWeightPerUnitGrams: null, presentationFormat: "Cubeta 5 kg",
      baseUnitCost: null, standardWastePercentage: 0,
      vatCode: "SR4", vatPercentage: 4, pricingMethod: "MARGEN", targetMarginPercentage: null, targetRetailPriceIncludingVat: null, fixedRetailPriceIncludingVat: null, appliedRetailPriceIncludingVat: null, appliedRetailPriceExcludingVat: null, actualMarginPercentage: null, percentagePointDeviation: null, unitDifference: null, pricingDiagnosis: null,
      stockControl: "SI", valuationMethod: "PMP", minimumStock: 2, maximumStock: 10, reorderPoint: 3, location: "Cámara refrigeración", abcClass: "B",
      batchControl: "SI", shelfLifeDays: 3, storageConditions: "Refrigerado (0-4 C)", allergens: "Gluten",
      status: "Activo", isExample: true,
    },
    {
      code: "SE-SEM-002", itemType: "SE", posDescription: "Masa hojaldre", fullDescription: "Masa de hojaldre laminada",
      family: "Semielaborados", subfamily: "Masas", section: "Pastelería/Obrador", isPurchasable: false, isPrepared: true, isSellable: false, hasRecipe: true,
      baseStockUnit: "kg", purchaseUnit: null, purchaseToBaseFactor: null, salesUnit: null, salesToBaseFactor: null, netWeightPerUnitGrams: null, presentationFormat: "Plancha 2 kg",
      baseUnitCost: null, standardWastePercentage: 5.0,
      vatCode: "SR4", vatPercentage: 4, pricingMethod: "MARGEN", targetMarginPercentage: null, targetRetailPriceIncludingVat: null, fixedRetailPriceIncludingVat: null, appliedRetailPriceIncludingVat: null, appliedRetailPriceExcludingVat: null, actualMarginPercentage: null, percentagePointDeviation: null, unitDifference: null, pricingDiagnosis: null,
      stockControl: "SI", valuationMethod: "FIFO", minimumStock: 5, maximumStock: 20, reorderPoint: 8, location: "Congelador", abcClass: "A",
      batchControl: "SI", shelfLifeDays: 30, storageConditions: "Congelado (-18 C)", allergens: "Gluten; Leche",
      status: "Activo", isExample: true,
    },
    {
      code: "SE-SEM-003", itemType: "SE", posDescription: "Crema pastelera", fullDescription: "Crema pastelera de vainilla",
      family: "Semielaborados", subfamily: "Cremas y rellenos", section: "Pastelería/Obrador", isPurchasable: false, isPrepared: true, isSellable: false, hasRecipe: true,
      baseStockUnit: "kg", purchaseUnit: null, purchaseToBaseFactor: null, salesUnit: null, salesToBaseFactor: null, netWeightPerUnitGrams: null, presentationFormat: "Cubeta 5 kg",
      baseUnitCost: null, standardWastePercentage: 1.0,
      vatCode: "SR4", vatPercentage: 4, pricingMethod: "MARGEN", targetMarginPercentage: null, targetRetailPriceIncludingVat: null, fixedRetailPriceIncludingVat: null, appliedRetailPriceIncludingVat: null, appliedRetailPriceExcludingVat: null, actualMarginPercentage: null, percentagePointDeviation: null, unitDifference: null, pricingDiagnosis: null,
      stockControl: "SI", valuationMethod: "PMP", minimumStock: 3, maximumStock: 10, reorderPoint: 5, location: "Cámara refrigeración", abcClass: "B",
      batchControl: "SI", shelfLifeDays: 3, storageConditions: "Refrigerado (0-4 C)", allergens: "Gluten; Huevos; Leche",
      status: "Activo", isExample: true,
    },
    {
      code: "SE-SEM-004", itemType: "SE", posDescription: "Plancha bizcocho", fullDescription: "Plancha bizcocho genovés 60×40 cm",
      family: "Semielaborados", subfamily: "Bizcochos", section: "Pastelería/Obrador", isPurchasable: false, isPrepared: true, isSellable: false, hasRecipe: true,
      baseStockUnit: "ud", purchaseUnit: null, purchaseToBaseFactor: null, salesUnit: null, salesToBaseFactor: null, netWeightPerUnitGrams: null, presentationFormat: "Plancha industrial",
      baseUnitCost: null, standardWastePercentage: 3.0,
      vatCode: "RD10", vatPercentage: 10, pricingMethod: "MARGEN", targetMarginPercentage: null, targetRetailPriceIncludingVat: null, fixedRetailPriceIncludingVat: null, appliedRetailPriceIncludingVat: null, appliedRetailPriceExcludingVat: null, actualMarginPercentage: null, percentagePointDeviation: null, unitDifference: null, pricingDiagnosis: null,
      stockControl: "SI", valuationMethod: "PMP", minimumStock: 2, maximumStock: 6, reorderPoint: 3, location: "Obrador", abcClass: "B",
      batchControl: "SI", shelfLifeDays: 2, storageConditions: "Ambiente", allergens: "Gluten; Huevos; Leche",
      status: "Activo", isExample: true,
    },
    {
      code: "PT-PAN-001", itemType: "PT", posDescription: "Barra rústica 250 g", fullDescription: "Barra rústica de masa madre 250 g",
      family: "Pan", subfamily: "Barra", section: "Panadería", isPurchasable: false, isPrepared: true, isSellable: true, hasRecipe: true,
      baseStockUnit: "ud", purchaseUnit: null, purchaseToBaseFactor: null, salesUnit: "ud", salesToBaseFactor: 1, netWeightPerUnitGrams: 250, presentationFormat: "Pieza individual",
      baseUnitCost: 0.35, standardWastePercentage: 1.0,
      vatCode: "SR4", vatPercentage: 4, pricingMethod: "FIJO", targetMarginPercentage: 70, targetRetailPriceIncludingVat: 1.19, fixedRetailPriceIncludingVat: 1.20, appliedRetailPriceIncludingVat: 1.20, appliedRetailPriceExcludingVat: 1.1538, actualMarginPercentage: 69.65, percentagePointDeviation: -0.35, unitDifference: 0.01, pricingDiagnosis: "EN OBJETIVO",
      stockControl: "SI", valuationMethod: "PMP", minimumStock: 0, maximumStock: 500, reorderPoint: null, location: "Tienda / vitrina", abcClass: "A",
      batchControl: "SI", shelfLifeDays: 1, storageConditions: "Ambiente", allergens: "Gluten",
      status: "Activo", isExample: true,
    },
    {
      code: "PT-PAN-002", itemType: "PT", posDescription: "Hogaza integral 500g", fullDescription: "Hogaza integral 500 g con semillas",
      family: "Pan", subfamily: "Hogaza", section: "Panadería", isPurchasable: false, isPrepared: true, isSellable: true, hasRecipe: true,
      baseStockUnit: "ud", purchaseUnit: null, purchaseToBaseFactor: null, salesUnit: "ud", salesToBaseFactor: 1, netWeightPerUnitGrams: 500, presentationFormat: "Pieza individual",
      baseUnitCost: 0.65, standardWastePercentage: 1.0,
      vatCode: "SR4", vatPercentage: 4, pricingMethod: "FIJO", targetMarginPercentage: 70, targetRetailPriceIncludingVat: 2.38, fixedRetailPriceIncludingVat: 2.40, appliedRetailPriceIncludingVat: 2.40, appliedRetailPriceExcludingVat: 2.3077, actualMarginPercentage: 71.84, percentagePointDeviation: 1.84, unitDifference: 0.02, pricingDiagnosis: "EN OBJETIVO",
      stockControl: "SI", valuationMethod: "PMP", minimumStock: 0, maximumStock: 200, reorderPoint: null, location: "Tienda / vitrina", abcClass: "B",
      batchControl: "SI", shelfLifeDays: 1, storageConditions: "Ambiente", allergens: "Gluten",
      status: "Activo", isExample: true,
    },
    {
      code: "PT-PAN-003", itemType: "PT", posDescription: "Chapata 200 g", fullDescription: "Chapata 200 g con masa madre",
      family: "Pan", subfamily: "Chapata", section: "Panadería", isPurchasable: false, isPrepared: true, isSellable: true, hasRecipe: true,
      baseStockUnit: "ud", purchaseUnit: null, purchaseToBaseFactor: null, salesUnit: "ud", salesToBaseFactor: 1, netWeightPerUnitGrams: 200, presentationFormat: "Pieza individual",
      baseUnitCost: 0.30, standardWastePercentage: 1.0,
      vatCode: "SR4", vatPercentage: 4, pricingMethod: "FIJO", targetMarginPercentage: 70, targetRetailPriceIncludingVat: 1.05, fixedRetailPriceIncludingVat: 1.10, appliedRetailPriceIncludingVat: 1.10, appliedRetailPriceExcludingVat: 1.0577, actualMarginPercentage: 71.64, percentagePointDeviation: 1.64, unitDifference: 0.05, pricingDiagnosis: "EN OBJETIVO",
      stockControl: "SI", valuationMethod: "PMP", minimumStock: 0, maximumStock: 300, reorderPoint: null, location: "Tienda / vitrina", abcClass: "A",
      batchControl: "SI", shelfLifeDays: 1, storageConditions: "Ambiente", allergens: "Gluten",
      status: "Activo", isExample: true,
    },
    {
      code: "PT-PAN-004", itemType: "PT", posDescription: "Pan molde 750 g", fullDescription: "Pan de molde 750 g laminado",
      family: "Pan", subfamily: "Pan de molde", section: "Panadería", isPurchasable: false, isPrepared: true, isSellable: true, hasRecipe: true,
      baseStockUnit: "ud", purchaseUnit: null, purchaseToBaseFactor: null, salesUnit: "ud", salesToBaseFactor: 1, netWeightPerUnitGrams: 750, presentationFormat: "Barra molde",
      baseUnitCost: 0.45, standardWastePercentage: 1.0,
      vatCode: "SR4", vatPercentage: 4, pricingMethod: "FIJO", targetMarginPercentage: 60, targetRetailPriceIncludingVat: 1.20, fixedRetailPriceIncludingVat: 1.20, appliedRetailPriceIncludingVat: 1.20, appliedRetailPriceExcludingVat: 1.1538, actualMarginPercentage: 60.98, percentagePointDeviation: 0.98, unitDifference: 0.00, pricingDiagnosis: "EN OBJETIVO",
      stockControl: "SI", valuationMethod: "PMP", minimumStock: 0, maximumStock: 200, reorderPoint: null, location: "Tienda / vitrina", abcClass: "B",
      batchControl: "SI", shelfLifeDays: 3, storageConditions: "Ambiente", allergens: "Gluten",
      status: "Activo", isExample: true,
    },
    {
      code: "PT-BOL-001", itemType: "PT", posDescription: "Croissant mantequilla", fullDescription: "Croissant de mantequilla artesanal",
      family: "Bollería", subfamily: "Croissantería", section: "Pastelería/Obrador", isPurchasable: false, isPrepared: true, isSellable: true, hasRecipe: true,
      baseStockUnit: "ud", purchaseUnit: null, purchaseToBaseFactor: null, salesUnit: "ud", salesToBaseFactor: 1, netWeightPerUnitGrams: 80, presentationFormat: "Pieza individual",
      baseUnitCost: 0.25, standardWastePercentage: 2.0,
      vatCode: "RD10", vatPercentage: 10, pricingMethod: "FIJO", targetMarginPercentage: 65, targetRetailPriceIncludingVat: 0.79, fixedRetailPriceIncludingVat: 0.80, appliedRetailPriceIncludingVat: 0.80, appliedRetailPriceExcludingVat: 0.7273, actualMarginPercentage: 65.63, percentagePointDeviation: 0.63, unitDifference: 0.01, pricingDiagnosis: "EN OBJETIVO",
      stockControl: "SI", valuationMethod: "PMP", minimumStock: 0, maximumStock: 100, reorderPoint: null, location: "Tienda / vitrina", abcClass: "A",
      batchControl: "NO", shelfLifeDays: 1, storageConditions: "Ambiente", allergens: "Gluten; Huevos; Leche",
      status: "Activo", isExample: true,
    },
    {
      code: "PT-BOL-002", itemType: "PT", posDescription: "Napolitana chocolate", fullDescription: "Napolitana de chocolate 100 g",
      family: "Bollería", subfamily: "Hojaldre", section: "Pastelería/Obrador", isPurchasable: false, isPrepared: true, isSellable: true, hasRecipe: true,
      baseStockUnit: "ud", purchaseUnit: null, purchaseToBaseFactor: null, salesUnit: "ud", salesToBaseFactor: 1, netWeightPerUnitGrams: 100, presentationFormat: "Pieza individual",
      baseUnitCost: 0.30, standardWastePercentage: 2.0,
      vatCode: "RD10", vatPercentage: 10, pricingMethod: "FIJO", targetMarginPercentage: 65, targetRetailPriceIncludingVat: 0.95, fixedRetailPriceIncludingVat: 0.95, appliedRetailPriceIncludingVat: 0.95, appliedRetailPriceExcludingVat: 0.8636, actualMarginPercentage: 65.26, percentagePointDeviation: 0.26, unitDifference: 0.00, pricingDiagnosis: "EN OBJETIVO",
      stockControl: "SI", valuationMethod: "PMP", minimumStock: 0, maximumStock: 80, reorderPoint: null, location: "Tienda / vitrina", abcClass: "A",
      batchControl: "NO", shelfLifeDays: 1, storageConditions: "Ambiente", allergens: "Gluten; Huevos; Leche",
      status: "Activo", isExample: true,
    },
    {
      code: "PT-BOL-003", itemType: "PT", posDescription: "Magdalena artesana", fullDescription: "Magdalena artesana de vainilla 60 g",
      family: "Bollería", subfamily: "Magdalenas y muffins", section: "Pastelería/Obrador", isPurchasable: false, isPrepared: true, isSellable: true, hasRecipe: true,
      baseStockUnit: "ud", purchaseUnit: null, purchaseToBaseFactor: null, salesUnit: "ud", salesToBaseFactor: 1, netWeightPerUnitGrams: 60, presentationFormat: "Pieza individual",
      baseUnitCost: 0.15, standardWastePercentage: 2.0,
      vatCode: "RD10", vatPercentage: 10, pricingMethod: "FIJO", targetMarginPercentage: 60, targetRetailPriceIncludingVat: 0.42, fixedRetailPriceIncludingVat: 0.40, appliedRetailPriceIncludingVat: 0.40, appliedRetailPriceExcludingVat: 0.3636, actualMarginPercentage: 58.74, percentagePointDeviation: -1.26, unitDifference: -0.02, pricingDiagnosis: "AJUSTADO",
      stockControl: "SI", valuationMethod: "PMP", minimumStock: 0, maximumStock: 60, reorderPoint: null, location: "Tienda / vitrina", abcClass: "B",
      batchControl: "NO", shelfLifeDays: 1, storageConditions: "Ambiente", allergens: "Gluten; Huevos; Leche",
      status: "Activo", isExample: true,
    },
    {
      code: "PT-PAS-001", itemType: "PT", posDescription: "Palmera hojaldre", fullDescription: "Palmera de hojaldre glazed 80 g",
      family: "Pastelería", subfamily: "Hojaldre", section: "Pastelería/Obrador", isPurchasable: false, isPrepared: true, isSellable: true, hasRecipe: true,
      baseStockUnit: "ud", purchaseUnit: null, purchaseToBaseFactor: null, salesUnit: "ud", salesToBaseFactor: 1, netWeightPerUnitGrams: 80, presentationFormat: "Pieza individual",
      baseUnitCost: 0.20, standardWastePercentage: 2.0,
      vatCode: "RD10", vatPercentage: 10, pricingMethod: "FIJO", targetMarginPercentage: 60, targetRetailPriceIncludingVat: 0.56, fixedRetailPriceIncludingVat: 0.55, appliedRetailPriceIncludingVat: 0.55, appliedRetailPriceExcludingVat: 0.50, actualMarginPercentage: 60.00, percentagePointDeviation: 0.00, unitDifference: -0.01, pricingDiagnosis: "EN OBJETIVO",
      stockControl: "SI", valuationMethod: "PMP", minimumStock: 0, maximumStock: 60, reorderPoint: null, location: "Tienda / vitrina", abcClass: "B",
      batchControl: "NO", shelfLifeDays: 1, storageConditions: "Ambiente", allergens: "Gluten; Leche",
      status: "Activo", isExample: true,
    },
    {
      code: "PT-TAR-001", itemType: "PT", posDescription: "Tarta queso porción", fullDescription: "Tarta de queso porción 120 g",
      family: "Tartas", subfamily: "Tarta por porción", section: "Pastelería/Obrador", isPurchasable: false, isPrepared: true, isSellable: true, hasRecipe: true,
      baseStockUnit: "porción", purchaseUnit: null, purchaseToBaseFactor: null, salesUnit: "porción", salesToBaseFactor: 1, netWeightPerUnitGrams: 120, presentationFormat: "Porción individual envasada",
      baseUnitCost: 0.80, standardWastePercentage: 3.0,
      vatCode: "RD10", vatPercentage: 10, pricingMethod: "FIJO", targetMarginPercentage: 70, targetRetailPriceIncludingVat: 2.93, fixedRetailPriceIncludingVat: 2.90, appliedRetailPriceIncludingVat: 2.90, appliedRetailPriceExcludingVat: 2.6364, actualMarginPercentage: 69.65, percentagePointDeviation: -0.35, unitDifference: -0.03, pricingDiagnosis: "EN OBJETIVO",
      stockControl: "SI", valuationMethod: "PMP", minimumStock: 0, maximumStock: 30, reorderPoint: null, location: "Tienda / vitrina", abcClass: "A",
      batchControl: "SI", shelfLifeDays: 3, storageConditions: "Refrigerado (0-4 C)", allergens: "Gluten; Huevos; Leche",
      status: "Activo", isExample: true,
    },
    {
      code: "PT-TAR-002", itemType: "PT", posDescription: "Tarta Sacher 24cm", fullDescription: "Tarta Sacher entera 24 cm chocolate",
      family: "Tartas", subfamily: "Tarta entera", section: "Pastelería/Obrador", isPurchasable: false, isPrepared: true, isSellable: true, hasRecipe: true,
      baseStockUnit: "ud", purchaseUnit: null, purchaseToBaseFactor: null, salesUnit: "ud", salesToBaseFactor: 1, netWeightPerUnitGrams: 1200, presentationFormat: "Tarta entera 24 cm",
      baseUnitCost: 5.50, standardWastePercentage: 3.0,
      vatCode: "RD10", vatPercentage: 10, pricingMethod: "FIJO", targetMarginPercentage: 70, targetRetailPriceIncludingVat: 20.33, fixedRetailPriceIncludingVat: 20.00, appliedRetailPriceIncludingVat: 20.00, appliedRetailPriceExcludingVat: 18.1818, actualMarginPercentage: 69.75, percentagePointDeviation: -0.25, unitDifference: -0.33, pricingDiagnosis: "EN OBJETIVO",
      stockControl: "SI", valuationMethod: "PMP", minimumStock: 0, maximumStock: 10, reorderPoint: null, location: "Cámara refrigeración", abcClass: "B",
      batchControl: "SI", shelfLifeDays: 5, storageConditions: "Refrigerado (0-4 C)", allergens: "Gluten; Huevos; Leche",
      status: "Activo", isExample: true,
    },
    {
      code: "PT-SLD-001", itemType: "PT", posDescription: "Empanada atún", fullDescription: "Empanada de atún porción 150 g",
      family: "Salados", subfamily: "Empanadas", section: "Salados", isPurchasable: false, isPrepared: true, isSellable: true, hasRecipe: true,
      baseStockUnit: "porción", purchaseUnit: null, purchaseToBaseFactor: null, salesUnit: "porción", salesToBaseFactor: 1, netWeightPerUnitGrams: 150, presentationFormat: "Porción individual",
      baseUnitCost: 0.55, standardWastePercentage: 2.0,
      vatCode: "RD10", vatPercentage: 10, pricingMethod: "FIJO", targetMarginPercentage: 65, targetRetailPriceIncludingVat: 1.74, fixedRetailPriceIncludingVat: 1.75, appliedRetailPriceIncludingVat: 1.75, appliedRetailPriceExcludingVat: 1.5909, actualMarginPercentage: 65.42, percentagePointDeviation: 0.42, unitDifference: 0.01, pricingDiagnosis: "EN OBJETIVO",
      stockControl: "SI", valuationMethod: "PMP", minimumStock: 0, maximumStock: 40, reorderPoint: null, location: "Tienda / vitrina", abcClass: "B",
      batchControl: "SI", shelfLifeDays: 2, storageConditions: "Refrigerado (0-4 C)", allergens: "Gluten; Pescado; Huevos",
      status: "Activo", isExample: true,
    },
    {
      code: "RV-CAF-001", itemType: "RV", posDescription: "Café grano natural", fullDescription: "Café en grano natural tueste medio 1 kg",
      family: "Cafetería", subfamily: "Café", section: "Cafetería", isPurchasable: true, isPrepared: false, isSellable: true, hasRecipe: false,
      baseStockUnit: "kg", purchaseUnit: "paquete", purchaseToBaseFactor: 1, salesUnit: "kg", salesToBaseFactor: 1, netWeightPerUnitGrams: null, presentationFormat: "Bolsa 1 kg",
      baseUnitCost: 12.00, standardWastePercentage: 0,
      vatCode: "RD10", vatPercentage: 10, pricingMethod: "MARGEN", targetMarginPercentage: null, targetRetailPriceIncludingVat: null, fixedRetailPriceIncludingVat: null, appliedRetailPriceIncludingVat: null, appliedRetailPriceExcludingVat: null, actualMarginPercentage: null, percentagePointDeviation: null, unitDifference: null, pricingDiagnosis: null,
      stockControl: "SI", valuationMethod: "PMP", minimumStock: 5, maximumStock: 20, reorderPoint: 8, location: "Almacén seco", abcClass: "A",
      batchControl: "SI", shelfLifeDays: 365, storageConditions: "Seco y ventilado", allergens: null,
      status: "Activo", isExample: true,
    },
    {
      code: "RV-BEB-001", itemType: "RV", posDescription: "Agua mineral 50 cl", fullDescription: "Agua mineral natural 50 cl botella",
      family: "Bebidas", subfamily: "Agua y zumos", section: "Reventa", isPurchasable: true, isPrepared: false, isSellable: true, hasRecipe: false,
      baseStockUnit: "ud", purchaseUnit: "caja", purchaseToBaseFactor: 12, salesUnit: "ud", salesToBaseFactor: 1, netWeightPerUnitGrams: null, presentationFormat: "Caja 12 × 50 cl",
      baseUnitCost: 0.25, standardWastePercentage: 0,
      vatCode: "RD10", vatPercentage: 10, pricingMethod: "FIJO", targetMarginPercentage: 55, targetRetailPriceIncludingVat: 0.62, fixedRetailPriceIncludingVat: 0.90, appliedRetailPriceIncludingVat: 0.90, appliedRetailPriceExcludingVat: 0.8182, actualMarginPercentage: 69.44, percentagePointDeviation: 14.44, unitDifference: 0.28, pricingDiagnosis: "POR ENCIMA",
      stockControl: "SI", valuationMethod: "PMP", minimumStock: 24, maximumStock: 120, reorderPoint: 48, location: "Almacén seco", abcClass: "B",
      batchControl: "NO", shelfLifeDays: null, storageConditions: "Seco y ventilado", allergens: null,
      status: "Activo", isExample: true,
    },
    {
      code: "RV-BEB-002", itemType: "RV", posDescription: "Refresco cola lata", fullDescription: "Refresco cola lata 33 cl",
      family: "Bebidas", subfamily: "Refrescos", section: "Reventa", isPurchasable: true, isPrepared: false, isSellable: true, hasRecipe: false,
      baseStockUnit: "ud", purchaseUnit: "caja", purchaseToBaseFactor: 6, salesUnit: "ud", salesToBaseFactor: 1, netWeightPerUnitGrams: null, presentationFormat: "Caja 6 × 33 cl",
      baseUnitCost: 0.55, standardWastePercentage: 0,
      vatCode: "GN21", vatPercentage: 21, pricingMethod: "FIJO", targetMarginPercentage: 50, targetRetailPriceIncludingVat: 1.23, fixedRetailPriceIncludingVat: 1.60, appliedRetailPriceIncludingVat: 1.60, appliedRetailPriceExcludingVat: 1.3223, actualMarginPercentage: 58.41, percentagePointDeviation: 8.41, unitDifference: 0.37, pricingDiagnosis: "POR ENCIMA",
      stockControl: "SI", valuationMethod: "PMP", minimumStock: 12, maximumStock: 60, reorderPoint: 24, location: "Almacén seco", abcClass: "B",
      batchControl: "NO", shelfLifeDays: null, storageConditions: "Seco y ventilado", allergens: null,
      status: "Activo", isExample: true,
    },
  ]
  */

  console.log("  Example products are not inserted")

  // Suppliers
  const suppliers = [
    {
      legalName: "Harinas del Sur",
      taxId: "A12345678",
      contactName: "Manuel García",
      contactPhone: "950123456",
      contactEmail: "manuel@harinasdelsur.es",
      billingAddress: "Pol. Ind. Los Olivos, C/ Trigo 12, 04120 Almería",
      termsNotes: "Proveedor principal de harinas. Entrega los martes y jueves.",
      serviceCategory: "Harinas y cereales",
      paymentTerms: "Transferencia 30 días",
      deliveryLeadTimeDays: 2,
      status: "Activo",
      reliabilityRating: 5,
      qualityRating: 4,
      priceRating: 4,
    },
    {
      legalName: "Café Miguel",
      taxId: "B87654321",
      contactName: "Miguel Torres",
      contactPhone: "915678901",
      contactEmail: "miguel@cafemiguel.com",
      billingAddress: "C/ Mayor 45, 28001 Madrid",
      termsNotes: "Café en grano y molido. Mínimo pedido 50€.",
      serviceCategory: "Bebidas",
      paymentTerms: "Efectivo / Bizum",
      deliveryLeadTimeDays: 3,
      status: "Activo",
      reliabilityRating: 4,
      qualityRating: 5,
      priceRating: 4,
    },
    {
      legalName: "Lácteos La Vega",
      taxId: "C11223344",
      contactName: "Ana Ruiz",
      contactPhone: "945123456",
      contactEmail: "ana@lacteoslavega.es",
      billingAddress: "C/ Pradera 8, 01001 Vitoria-Gasteiz",
      termsNotes: "Leche, mantequilla, nata y queso. Entrega diaria excepto domingos.",
      serviceCategory: "Lácteos",
      paymentTerms: "Transferencia 15 días",
      deliveryLeadTimeDays: 1,
      status: "Activo",
      reliabilityRating: 5,
      qualityRating: 5,
      priceRating: 3,
    },
    {
      legalName: "Pastas Frescas Don Carlo",
      taxId: "D55667788",
      contactName: "Carlo Bianchi",
      contactPhone: "934567890",
      contactEmail: "carlo@doncarlo.es",
      billingAddress: "C/ Industria 23, 08100 Mollet del Vallès",
      termsNotes: "Pastas frescas artesanales. Pedidos mínimos 100€.",
      serviceCategory: "Pastas y harinas",
      paymentTerms: "Transferencia 30 días",
      deliveryLeadTimeDays: 1,
      status: "Activo",
      reliabilityRating: 4,
      qualityRating: 5,
      priceRating: 3,
    },
  ]

  for (const prov of suppliers) {
    await prisma.supplier.upsert({
      where: { taxId: prov.taxId },
      update: {},
      create: prov,
    })
  }

  console.log(`  ${suppliers.length} suppliers inserted`)

  // Link suppliers to products (SupplierProduct)
  const flourSupplier = await prisma.supplier.findUnique({ where: { taxId: "A12345678" } })
  const coffeeSupplier = await prisma.supplier.findUnique({ where: { taxId: "B87654321" } })
  const dairySupplier = await prisma.supplier.findUnique({ where: { taxId: "C11223344" } })
  const pastaSupplier = await prisma.supplier.findUnique({ where: { taxId: "D55667788" } })

  const supplierProducts: { productCode: string; supplierId: string; supplierReference: string; purchasePriceExcludingVat: number | null; deliveryLeadTimeDays: number | null; minimumOrder: number | null; isPrimary: boolean }[] = []

  // Flour supplier -> flour products
  if (flourSupplier) {
    supplierProducts.push(
      { productCode: "MP-HAR-001", supplierId: flourSupplier.id, supplierReference: "HS-HAR-TRIGO", purchasePriceExcludingVat: 0.38, deliveryLeadTimeDays: 2, minimumOrder: 200, isPrimary: true },
      { productCode: "MP-HAR-002", supplierId: flourSupplier.id, supplierReference: "HS-HAR-CENT", purchasePriceExcludingVat: 0.50, deliveryLeadTimeDays: 2, minimumOrder: 200, isPrimary: true },
      { productCode: "MP-HAR-003", supplierId: flourSupplier.id, supplierReference: "HS-HAR-TRIGR", purchasePriceExcludingVat: 0.45, deliveryLeadTimeDays: 2, minimumOrder: 200, isPrimary: true },
      { productCode: "MP-HAR-004", supplierId: flourSupplier.id, supplierReference: "HS-HAR-MAIZ", purchasePriceExcludingVat: 0.55, deliveryLeadTimeDays: 3, minimumOrder: 200, isPrimary: true },
      { productCode: "MP-SEL-001", supplierId: flourSupplier.id, supplierReference: "HS-SEL-AVENA", purchasePriceExcludingVat: 0.90, deliveryLeadTimeDays: 2, minimumOrder: 150, isPrimary: true },
      { productCode: "MP-SEL-002", supplierId: flourSupplier.id, supplierReference: "HS-SEL-SESA", purchasePriceExcludingVat: 1.20, deliveryLeadTimeDays: 2, minimumOrder: 150, isPrimary: true },
      { productCode: "MP-SEL-003", supplierId: flourSupplier.id, supplierReference: "HS-SEL-CHIA", purchasePriceExcludingVat: 1.80, deliveryLeadTimeDays: 3, minimumOrder: 150, isPrimary: true },
      { productCode: "MP-SEL-004", supplierId: flourSupplier.id, supplierReference: "HS-SEL-LINO", purchasePriceExcludingVat: 1.00, deliveryLeadTimeDays: 3, minimumOrder: 150, isPrimary: true },
      { productCode: "EL-PAN-003", supplierId: flourSupplier.id, supplierReference: "HS-PAN-COCIDO", purchasePriceExcludingVat: null, deliveryLeadTimeDays: 2, minimumOrder: null, isPrimary: true },
    )
  }

  // Coffee supplier -> coffee products
  if (coffeeSupplier) {
    supplierProducts.push(
      { productCode: "MP-BEB-001", supplierId: coffeeSupplier.id, supplierReference: "CM-CAF-ARAB", purchasePriceExcludingVat: 18.00, deliveryLeadTimeDays: 3, minimumOrder: 50, isPrimary: true },
      { productCode: "MP-BEB-002", supplierId: coffeeSupplier.id, supplierReference: "CM-CAF-BOLI", purchasePriceExcludingVat: 12.00, deliveryLeadTimeDays: 3, minimumOrder: 50, isPrimary: true },
      { productCode: "MP-BEB-004", supplierId: coffeeSupplier.id, supplierReference: "CM-CAF-DES", purchasePriceExcludingVat: 22.00, deliveryLeadTimeDays: 5, minimumOrder: 100, isPrimary: true },
      { productCode: "MP-BEB-005", supplierId: coffeeSupplier.id, supplierReference: "CM-CAF-CHOC", purchasePriceExcludingVat: 8.50, deliveryLeadTimeDays: 3, minimumOrder: 50, isPrimary: true },
    )
  }

  // Dairy supplier -> dairy products
  if (dairySupplier) {
    supplierProducts.push(
      { productCode: "MP-LAC-001", supplierId: dairySupplier.id, supplierReference: "LLV-LAC-LECH", purchasePriceExcludingVat: 0.80, deliveryLeadTimeDays: 1, minimumOrder: 30, isPrimary: true },
      { productCode: "MP-LAC-002", supplierId: dairySupplier.id, supplierReference: "LLV-LAC-MANT", purchasePriceExcludingVat: 8.50, deliveryLeadTimeDays: 1, minimumOrder: 30, isPrimary: true },
      { productCode: "MP-LAC-003", supplierId: dairySupplier.id, supplierReference: "LLV-LAC-NATA", purchasePriceExcludingVat: 6.20, deliveryLeadTimeDays: 1, minimumOrder: 30, isPrimary: true },
      { productCode: "MP-LAC-004", supplierId: dairySupplier.id, supplierReference: "LLV-LAC-HUEV", purchasePriceExcludingVat: 0.18, deliveryLeadTimeDays: 1, minimumOrder: 50, isPrimary: true },
      { productCode: "MP-LAC-005", supplierId: dairySupplier.id, supplierReference: "LLV-LAC-MASC", purchasePriceExcludingVat: 9.50, deliveryLeadTimeDays: 2, minimumOrder: 20, isPrimary: true },
    )
  }

  // Pasta supplier -> bread products
  if (pastaSupplier) {
    supplierProducts.push(
      { productCode: "EL-PAN-001", supplierId: pastaSupplier.id, supplierReference: "DC-PAN-BAGU", purchasePriceExcludingVat: null, deliveryLeadTimeDays: 1, minimumOrder: null, isPrimary: false },
      { productCode: "EL-PAN-002", supplierId: pastaSupplier.id, supplierReference: "DC-PAN-CIOC", purchasePriceExcludingVat: null, deliveryLeadTimeDays: 1, minimumOrder: null, isPrimary: false },
    )
  }

  for (const supplierProduct of supplierProducts) {
    const product = await prisma.product.findUnique({ where: { code: supplierProduct.productCode } })
    if (product) {
      await prisma.supplierProduct.upsert({
        where: { supplierId_productId: { supplierId: supplierProduct.supplierId, productId: product.id } },
        update: {},
        create: {
          productId: product.id,
          supplierId: supplierProduct.supplierId,
          supplierReference: supplierProduct.supplierReference,
          purchasePriceExcludingVat: supplierProduct.purchasePriceExcludingVat,
          deliveryLeadTimeDays: supplierProduct.deliveryLeadTimeDays,
          minimumOrder: supplierProduct.minimumOrder,
          isPrimary: supplierProduct.isPrimary,
        },
      })
    }
  }

  console.log(`  ${supplierProducts.length} supplier-product links inserted`)

  const paymentCategories = [
    ["PER", "Personal", "Nómina, finiquitos y anticipos a empleados"],
    ["PER-SS", "Seguridad social y retenciones", "Cuotas y retenciones practicadas"],
    ["SUM", "Suministros", "Luz, agua, gas, teléfono e internet"],
    ["MAN", "Mantenimiento y reparaciones", "Reparaciones y partes de servicio"],
    ["ALQ", "Alquileres y cánones", "Locales y maquinaria"],
    ["SEG", "Seguros", "Pólizas del negocio"],
    ["SERV", "Servicios profesionales", "Asesoría y servicios externos"],
    ["LIM", "Limpieza e higiene", "Productos y servicios de limpieza"],
    ["TRIB", "Tributos y tasas", "Tasas y licencias"],
    ["FIN", "Gastos financieros", "Comisiones e intereses"],
    ["MEN", "Compras menores", "Compras menores acotadas a caja chica"],
    ["OTR", "Otros", "Requiere autorización de dirección"],
  ] as const
  for (const [code, name, description] of paymentCategories) {
    await prisma.expenseCategory.upsert({ where: { code }, update: { name, description }, create: { code, name, description } })
  }

  const paymentMethodsPayment = [
    { id: "MP-TRANSF", type: PaymentMethodType.BANK_TRANSFER, requiresAccount: true, bankReconciliable: true },
    { id: "MP-DOMIC", type: PaymentMethodType.DIRECT_DEBIT, requiresAccount: true, bankReconciliable: true },
    { id: "MP-TARJ", type: PaymentMethodType.CARD, requiresAccount: true, bankReconciliable: true },
    { id: "MP-EFECT", type: PaymentMethodType.CASH, requiresAccount: true, bankReconciliable: false },
    { id: "MP-CHEQUE", type: PaymentMethodType.CHECK, requiresAccount: true, bankReconciliable: true },
    { id: "MP-MOVIL", type: PaymentMethodType.MOBILE_PAYMENT, requiresAccount: true, bankReconciliable: true },
  ]
  for (const paymentMethod of paymentMethodsPayment) {
    await prisma.paymentMethod.upsert({ where: { id: paymentMethod.id }, update: paymentMethod, create: paymentMethod })
  }

  for (const supplier of await prisma.supplier.findMany({ select: { id: true, legalName: true, taxId: true } })) {
    await prisma.creditor.upsert({
      where: { supplierId: supplier.id },
      update: { name: supplier.legalName, taxId: supplier.taxId },
      create: { code: `PRV-${supplier.id.slice(-8).toUpperCase()}`, type: CreditorType.MERCHANDISE_SUPPLIER, name: supplier.legalName, taxId: supplier.taxId, supplierId: supplier.id },
    })
  }

  console.log(`  ${paymentCategories.length} categories, ${paymentMethodsPayment.length} payment methods, and supplier creditors prepared`)
  console.log("Seed completed.")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
