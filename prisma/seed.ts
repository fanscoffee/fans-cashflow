import "dotenv/config"
import { PrismaClient } from "../src/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { calculateProductPricing } from "../src/lib/product-pricing"

const url = process.env.DIRECT_URL || process.env.DATABASE_URL!
const adapter = new PrismaPg({ connectionString: url })
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log("Seeding catálogos...")

  const catalogos = [
    { tipo: "TIPO_ARTICULO", valor: "MP", descripcion: "Materia prima" },
    { tipo: "TIPO_ARTICULO", valor: "IN", descripcion: "Insumo / envase" },
    { tipo: "TIPO_ARTICULO", valor: "SE", descripcion: "Semielaborado" },
    { tipo: "TIPO_ARTICULO", valor: "PT", descripcion: "Producto terminado" },
    { tipo: "TIPO_ARTICULO", valor: "RV", descripcion: "Reventa" },

    { tipo: "SECCION", valor: "Panadería", descripcion: "Área de panadería" },
    { tipo: "SECCION", valor: "Pastelería/Obrador", descripcion: "Área de pastelería y obrador" },
    { tipo: "SECCION", valor: "Salados", descripcion: "Área de salados" },
    { tipo: "SECCION", valor: "Cafetería", descripcion: "Área de cafetería" },
    { tipo: "SECCION", valor: "Reventa", descripcion: "Productos de reventa" },
    { tipo: "SECCION", valor: "General", descripcion: "Uso general" },

    { tipo: "FAMILIA", valor: "Harinas y sémolas", prefijoCodigo: "HAR", descripcion: "Harinas, sémolas y cereales" },
    { tipo: "FAMILIA", valor: "Levaduras y mejorantes", prefijoCodigo: "LEV", descripcion: "Levaduras, mejorantes y premezclas" },
    { tipo: "FAMILIA", valor: "Azúcares y edulcorantes", prefijoCodigo: "AZU", descripcion: "Azúcares, miel, edulcorantes" },
    { tipo: "FAMILIA", valor: "Grasas y aceites", prefijoCodigo: "GRA", descripcion: "Mantequilla, margarina, aceites" },
    { tipo: "FAMILIA", valor: "Lácteos y huevos", prefijoCodigo: "LAC", descripcion: "Leche, nata, queso, huevo" },
    { tipo: "FAMILIA", valor: "Frutas y frutos secos", prefijoCodigo: "FRU", descripcion: "Fruta fresca, frutos secos, confitura" },
    { tipo: "FAMILIA", valor: "Chocolates y coberturas", prefijoCodigo: "CHO", descripcion: "Chocolate, coberturas, cacao" },
    { tipo: "FAMILIA", valor: "Aditivos y aromas", prefijoCodigo: "ADI", descripcion: "Colorantes, aromas, gelificantes" },
    { tipo: "FAMILIA", valor: "Sal y especias", prefijoCodigo: "SAL", descripcion: "Sal, pimienta, especias" },
    { tipo: "FAMILIA", valor: "Envases y embalajes", prefijoCodigo: "ENV", descripcion: "Bolsas, cajas, bandejas, etiquetas" },
    { tipo: "FAMILIA", valor: "Consumibles y limpieza", prefijoCodigo: "LIM", descripcion: "Productos de limpieza y consumibles" },
    { tipo: "FAMILIA", valor: "Pan", prefijoCodigo: "PAN", descripcion: "Panes y variaciones" },
    { tipo: "FAMILIA", valor: "Bollería", prefijoCodigo: "BOL", descripcion: "Croissants, napolitanas, magdalenas" },
    { tipo: "FAMILIA", valor: "Pastelería", prefijoCodigo: "PAS", descripcion: "Pastelería en general" },
    { tipo: "FAMILIA", valor: "Tartas", prefijoCodigo: "TAR", descripcion: "Tartas enteras y porciones" },
    { tipo: "FAMILIA", valor: "Salados", prefijoCodigo: "SLD", descripcion: "Empanadas, bocadillos, etc." },
    { tipo: "FAMILIA", valor: "Bebidas", prefijoCodigo: "BEB", descripcion: "Agua, refrescos, zumos" },
    { tipo: "FAMILIA", valor: "Cafetería", prefijoCodigo: "CAF", descripcion: "Café y productos de cafetería" },
    { tipo: "FAMILIA", valor: "Semielaborados", prefijoCodigo: "SEM", descripcion: "Masas, cremas, bizcochos del obrador" },

    { tipo: "SUBFAMILIA", valor: "Trigo", descripcion: "Harinas de trigo" },
    { tipo: "SUBFAMILIA", valor: "Integral / especiales", descripcion: "Harinas integrales y especiales" },
    { tipo: "SUBFAMILIA", valor: "Sin gluten", descripcion: "Harinas y productos sin gluten" },
    { tipo: "SUBFAMILIA", valor: "Levadura", descripcion: "Levadura fresca y seca" },
    { tipo: "SUBFAMILIA", valor: "Mejorante", descripcion: "Mejorantes para masa" },
    { tipo: "SUBFAMILIA", valor: "Azúcar", descripcion: "Azúcar blanca, morena" },
    { tipo: "SUBFAMILIA", valor: "Mantequilla", descripcion: "Mantequilla de vaca" },
    { tipo: "SUBFAMILIA", valor: "Margarina", descripcion: "Margarinas técnicas" },
    { tipo: "SUBFAMILIA", valor: "Aceite", descripcion: "Aceites de oliva, girasol" },
    { tipo: "SUBFAMILIA", valor: "Leche", descripcion: "Leche entera, desnatada" },
    { tipo: "SUBFAMILIA", valor: "Nata", descripcion: "Nata para montar y cocinar" },
    { tipo: "SUBFAMILIA", valor: "Queso", descripcion: "Quesos varios" },
    { tipo: "SUBFAMILIA", valor: "Huevo", descripcion: "Huevo fresco y líquido" },
    { tipo: "SUBFAMILIA", valor: "Fruta fresca", descripcion: "Frutas de temporada" },
    { tipo: "SUBFAMILIA", valor: "Frutos secos", descripcion: "Frutos secos variados" },
    { tipo: "SUBFAMILIA", valor: "Confitura", descripcion: "Mermeladas y confituras" },
    { tipo: "SUBFAMILIA", valor: "Cobertura", descripcion: "Coberturas de chocolate" },
    { tipo: "SUBFAMILIA", valor: "Cacao", descripcion: "Cacao en polvo" },
    { tipo: "SUBFAMILIA", valor: "Colorantes y aromas", descripcion: "Colorantes y extractos aromáticos" },
    { tipo: "SUBFAMILIA", valor: "Gelificantes", descripcion: "Gelatina, agar, pectina" },
    { tipo: "SUBFAMILIA", valor: "Bolsas y papel", descripcion: "Bolsas de papel y celofán" },
    { tipo: "SUBFAMILIA", valor: "Cajas", descripcion: "Cajas de cartón y presentación" },
    { tipo: "SUBFAMILIA", valor: "Bandejas", descripcion: "Bandejas de cartón y plástico" },
    { tipo: "SUBFAMILIA", valor: "Etiquetas", descripcion: "Etiquetas de ingredientes y precio" },
    { tipo: "SUBFAMILIA", valor: "Barra", descripcion: "Barras de pan" },
    { tipo: "SUBFAMILIA", valor: "Hogaza", descripcion: "Hogazas y panes redondos" },
    { tipo: "SUBFAMILIA", valor: "Chapata", descripcion: "Chapatas y pianos" },
    { tipo: "SUBFAMILIA", valor: "Pan de molde", descripcion: "Pan de molde y tostado" },
    { tipo: "SUBFAMILIA", valor: "Pan especial", descripcion: "Panes especiales (sin gluten, integral)" },
    { tipo: "SUBFAMILIA", valor: "Croissantería", descripcion: "Croissants y bollería hojaldrada" },
    { tipo: "SUBFAMILIA", valor: "Magdalenas y muffins", descripcion: "Magdalenas y muffins" },
    { tipo: "SUBFAMILIA", valor: "Donuts", descripcion: "Donuts y rosquillas" },
    { tipo: "SUBFAMILIA", valor: "Hojaldre", descripcion: "Palmeras, hojaldres" },
    { tipo: "SUBFAMILIA", valor: "Pastel individual", descripcion: "Pasteles individuales" },
    { tipo: "SUBFAMILIA", valor: "Tarta entera", descripcion: "Tartas enteras" },
    { tipo: "SUBFAMILIA", valor: "Tarta por porción", descripcion: "Tartas porciones" },
    { tipo: "SUBFAMILIA", valor: "Galletas", descripcion: "Galletas artesanas" },
    { tipo: "SUBFAMILIA", valor: "Empanadas", descripcion: "Empanadas y bordados" },
    { tipo: "SUBFAMILIA", valor: "Bocadillos", descripcion: "Bocadillos y sandwiches" },
    { tipo: "SUBFAMILIA", valor: "Masas", descripcion: "Masas base del obrador" },
    { tipo: "SUBFAMILIA", valor: "Cremas y rellenos", descripcion: "Cremas pasteleras y rellenos" },
    { tipo: "SUBFAMILIA", valor: "Bizcochos", descripcion: "Bizcochos y genoveses" },
    { tipo: "SUBFAMILIA", valor: "Almíbares", descripcion: "Almíbares y siropes" },
    { tipo: "SUBFAMILIA", valor: "Café", descripcion: "Café en grano, molido, capsulas" },
    { tipo: "SUBFAMILIA", valor: "Refrescos", descripcion: "Refrescos y bebidas azucaradas" },
    { tipo: "SUBFAMILIA", valor: "Agua y zumos", descripcion: "Agua mineral y zumos naturales" },
    { tipo: "SUBFAMILIA", valor: "Otros", descripcion: "Otros productos" },

    { tipo: "UNIDAD_MEDIDA", valor: "kg", descripcion: "Kilogramos" },
    { tipo: "UNIDAD_MEDIDA", valor: "g", descripcion: "Gramos" },
    { tipo: "UNIDAD_MEDIDA", valor: "l", descripcion: "Litros" },
    { tipo: "UNIDAD_MEDIDA", valor: "ml", descripcion: "Mililitros" },
    { tipo: "UNIDAD_MEDIDA", valor: "ud", descripcion: "Unidades" },
    { tipo: "UNIDAD_MEDIDA", valor: "docena", descripcion: "Docenas" },
    { tipo: "UNIDAD_MEDIDA", valor: "bandeja", descripcion: "Bandejas" },
    { tipo: "UNIDAD_MEDIDA", valor: "caja", descripcion: "Cajas" },
    { tipo: "UNIDAD_MEDIDA", valor: "saco", descripcion: "Sacos" },
    { tipo: "UNIDAD_MEDIDA", valor: "bote", descripcion: "Botes" },
    { tipo: "UNIDAD_MEDIDA", valor: "paquete", descripcion: "Paquetes" },
    { tipo: "UNIDAD_MEDIDA", valor: "porción", descripcion: "Porciones" },
    { tipo: "UNIDAD_MEDIDA", valor: "m", descripcion: "Metros" },

    { tipo: "SI_NO", valor: "SI", descripcion: "Sí" },
    { tipo: "SI_NO", valor: "NO", descripcion: "No" },

    { tipo: "VALORACION", valor: "PMP", descripcion: "Precio medio ponderado" },
    { tipo: "VALORACION", valor: "FIFO", descripcion: "First In, First Out" },

    { tipo: "METODO_PRECIO", valor: "MARGEN", descripcion: "Precio calculado desde margen objetivo" },
    { tipo: "METODO_PRECIO", valor: "FIJO", descripcion: "Precio fijado por el negocio" },

    { tipo: "CLASE_ABC", valor: "A", descripcion: "Alto valor, conteo semanal" },
    { tipo: "CLASE_ABC", valor: "B", descripcion: "Valor medio, conteo quincenal" },
    { tipo: "CLASE_ABC", valor: "C", descripcion: "Bajo valor, conteo mensual" },

    { tipo: "UBICACION", valor: "Almacén seco", descripcion: "Almacén de productos secos" },
    { tipo: "UBICACION", valor: "Cámara refrigeración", descripcion: "Cámara de refrigeración" },
    { tipo: "UBICACION", valor: "Congelador", descripcion: "Congelador" },
    { tipo: "UBICACION", valor: "Obrador", descripcion: "Zona de producción" },
    { tipo: "UBICACION", valor: "Tienda / vitrina", descripcion: "Zona de venta al público" },
    { tipo: "UBICACION", valor: "Trastienda", descripcion: "Almacén trasero" },
    { tipo: "UBICACION", valor: "Sin ubicación", descripcion: "Sin ubicación asignada" },

    { tipo: "CONSERVACION", valor: "Ambiente", descripcion: "Temperatura ambiente" },
    { tipo: "CONSERVACION", valor: "Refrigerado (0-4 C)", descripcion: "Refrigeración entre 0 y 4°C" },
    { tipo: "CONSERVACION", valor: "Congelado (-18 C)", descripcion: "Congelación a -18°C" },
    { tipo: "CONSERVACION", valor: "Seco y ventilado", descripcion: "Almacén seco con ventilación" },

    { tipo: "ESTADO", valor: "Activo", descripcion: "Artículo activo en catálogo" },
    { tipo: "ESTADO", valor: "Inactivo", descripcion: "Artículo temporalmente deshabilitado" },
    { tipo: "ESTADO", valor: "Descatalogado", descripcion: "Artículo dado de baja definitiva" },

    { tipo: "CODIGO_IVA", valor: "SR4", descripcion: "Superreducido 4% — Pan, harinas, leche, huevos" },
    { tipo: "CODIGO_IVA", valor: "RD10", descripcion: "Reducido 10% — Bollería, pastelería, hostelería" },
    { tipo: "CODIGO_IVA", valor: "GN21", descripcion: "General 21% — Bebidas alcohólicas, material no alimentario" },
    { tipo: "CODIGO_IVA", valor: "EX0", descripcion: "Exento / no sujeto" },

    { tipo: "ALERGENO", valor: "Gluten", descripcion: "Trigo, cebada, centeno, avena" },
    { tipo: "ALERGENO", valor: "Crustáceos", descripcion: "Cangrejos, gambas, langostinos" },
    { tipo: "ALERGENO", valor: "Huevos", descripcion: "Huevos de gallina" },
    { tipo: "ALERGENO", valor: "Pescado", descripcion: "Pescados y derivados" },
    { tipo: "ALERGENO", valor: "Cacahuetes", descripcion: "Cacahuetes y cacahuete" },
    { tipo: "ALERGENO", valor: "Soja", descripcion: "Soja y derivados" },
    { tipo: "ALERGENO", valor: "Leche", descripcion: "Leche y derivados (lactosa)" },
    { tipo: "ALERGENO", valor: "Frutos de cáscara", descripcion: "Almendras, avellanas, nueces" },
    { tipo: "ALERGENO", valor: "Apio", descripcion: "Apio y derivados" },
    { tipo: "ALERGENO", valor: "Mostaza", descripcion: "Mostaza y derivados" },
    { tipo: "ALERGENO", valor: "Sésamo", descripcion: "Sésamo y derivados" },
    { tipo: "ALERGENO", valor: "Sulfitos", descripcion: "Sulfitos en concentración >10mg/kg" },
    { tipo: "ALERGENO", valor: "Altramuces", descripcion: "Altramuces y derivados" },
    { tipo: "ALERGENO", valor: "Moluscos", descripcion: "Moluscos y derivados" },  ]

  for (const cat of catalogos) {
    await prisma.catalogo.upsert({
      where: { tipo_valor: { tipo: cat.tipo, valor: cat.valor } },
      update: {
        descripcion: cat.descripcion,
        ...(cat.tipo === "FAMILIA" ? { prefijoCodigo: cat.prefijoCodigo } : {}),
      },
      create: cat,
    })
  }

  console.log(`  ${catalogos.length} catálogos insertados/actualizados`)

  console.log("Seeding productos de ejemplo...")

  const productos = [
    {
      codigo: "MP-HAR-001", tipoArticulo: "MP", descripcionTpv: "Harina trigo W180", descripcionCompleta: "Harina trigo W180 saco 25 kg",
      familia: "Harinas y sémolas", subfamilia: "Trigo", seccion: "General", esComprable: true, esElaborado: false, esVendible: false, llevaReceta: false,
      umBaseStock: "kg", umCompra: "saco", factorCompraABase: 25, umVenta: null, factorVentaABase: null, pesoNetoUdG: null, formatoPresentacion: "Saco 25 kg",
      costeUmBase: 0.74, mermaEstandarPct: 1.0,
      codIva: "SR4", ivaPct: 4, metodoPrecio: "MARGEN", margenObjetivoPct: null, pvpObjetivoConIva: null, pvpFijoConIva: null, pvpAplicadoConIva: null, pvpAplicadoSinIva: null, margenRealPct: null, desviacionPp: null, diferenciaEurUd: null, diagnosticoPrecio: null,
      controlaStock: "SI", metodoValoracion: "PMP", stockMinimo: 50, stockMaximo: 300, puntoPedido: 100, ubicacion: "Almacén seco", claseAbc: "A",
      controlLote: "SI", vidaUtilDias: 180, conservacion: "Seco y ventilado", alergenos: "Gluten",
      estado: "Activo", esEjemplo: true,
    },
    {
      codigo: "MP-HAR-002", tipoArticulo: "MP", descripcionTpv: "Harina fuerza W300", descripcionCompleta: "Harina de fuerza W300 saco 25 kg",
      familia: "Harinas y sémolas", subfamilia: "Trigo", seccion: "General", esComprable: true, esElaborado: false, esVendible: false, llevaReceta: false,
      umBaseStock: "kg", umCompra: "saco", factorCompraABase: 25, umVenta: null, factorVentaABase: null, pesoNetoUdG: null, formatoPresentacion: "Saco 25 kg",
      costeUmBase: 0.88, mermaEstandarPct: 1.0,
      codIva: "SR4", ivaPct: 4, metodoPrecio: "MARGEN", margenObjetivoPct: null, pvpObjetivoConIva: null, pvpFijoConIva: null, pvpAplicadoConIva: null, pvpAplicadoSinIva: null, margenRealPct: null, desviacionPp: null, diferenciaEurUd: null, diagnosticoPrecio: null,
      controlaStock: "SI", metodoValoracion: "PMP", stockMinimo: 50, stockMaximo: 200, puntoPedido: 80, ubicacion: "Almacén seco", claseAbc: "A",
      controlLote: "SI", vidaUtilDias: 180, conservacion: "Seco y ventilado", alergenos: "Gluten",
      estado: "Activo", esEjemplo: true,
    },
    {
      codigo: "MP-LEV-001", tipoArticulo: "MP", descripcionTpv: "Levadura fresca", descripcionCompleta: "Levadura fresca panadero 1 kg",
      familia: "Levaduras y mejorantes", subfamilia: "Levadura", seccion: "General", esComprable: true, esElaborado: false, esVendible: false, llevaReceta: false,
      umBaseStock: "kg", umCompra: "paquete", factorCompraABase: 1, umVenta: null, factorVentaABase: null, pesoNetoUdG: null, formatoPresentacion: "Paquete 1 kg",
      costeUmBase: 3.20, mermaEstandarPct: 0.5,
      codIva: "SR4", ivaPct: 4, metodoPrecio: "MARGEN", margenObjetivoPct: null, pvpObjetivoConIva: null, pvpFijoConIva: null, pvpAplicadoConIva: null, pvpAplicadoSinIva: null, margenRealPct: null, desviacionPp: null, diferenciaEurUd: null, diagnosticoPrecio: null,
      controlaStock: "SI", metodoValoracion: "PMP", stockMinimo: 5, stockMaximo: 20, puntoPedido: 10, ubicacion: "Cámara refrigeración", claseAbc: "B",
      controlLote: "SI", vidaUtilDias: 14, conservacion: "Refrigerado (0-4 C)", alergenos: null,
      estado: "Activo", esEjemplo: true,
    },
    {
      codigo: "MP-SAL-001", tipoArticulo: "MP", descripcionTpv: "Sal marina fina", descripcionCompleta: "Sal marina fina saco 25 kg",
      familia: "Sal y especias", subfamilia: null, seccion: "General", esComprable: true, esElaborado: false, esVendible: false, llevaReceta: false,
      umBaseStock: "kg", umCompra: "saco", factorCompraABase: 25, umVenta: null, factorVentaABase: null, pesoNetoUdG: null, formatoPresentacion: "Saco 25 kg",
      costeUmBase: 0.48, mermaEstandarPct: 0,
      codIva: "SR4", ivaPct: 4, metodoPrecio: "MARGEN", margenObjetivoPct: null, pvpObjetivoConIva: null, pvpFijoConIva: null, pvpAplicadoConIva: null, pvpAplicadoSinIva: null, margenRealPct: null, desviacionPp: null, diferenciaEurUd: null, diagnosticoPrecio: null,
      controlaStock: "SI", metodoValoracion: "PMP", stockMinimo: 5, stockMaximo: 30, puntoPedido: 10, ubicacion: "Almacén seco", claseAbc: "C",
      controlLote: "NO", vidaUtilDias: null, conservacion: "Seco y ventilado", alergenos: null,
      estado: "Activo", esEjemplo: true,
    },
    {
      codigo: "MP-AZU-001", tipoArticulo: "MP", descripcionTpv: "Azúcar blanquilla", descripcionCompleta: "Azúcar blanquilla saco 25 kg",
      familia: "Azúcares y edulcorantes", subfamilia: "Azúcar", seccion: "General", esComprable: true, esElaborado: false, esVendible: false, llevaReceta: false,
      umBaseStock: "kg", umCompra: "saco", factorCompraABase: 25, umVenta: null, factorVentaABase: null, pesoNetoUdG: null, formatoPresentacion: "Saco 25 kg",
      costeUmBase: 0.66, mermaEstandarPct: 0,
      codIva: "SR4", ivaPct: 4, metodoPrecio: "MARGEN", margenObjetivoPct: null, pvpObjetivoConIva: null, pvpFijoConIva: null, pvpAplicadoConIva: null, pvpAplicadoSinIva: null, margenRealPct: null, desviacionPp: null, diferenciaEurUd: null, diagnosticoPrecio: null,
      controlaStock: "SI", metodoValoracion: "PMP", stockMinimo: 10, stockMaximo: 50, puntoPedido: 20, ubicacion: "Almacén seco", claseAbc: "B",
      controlLote: "NO", vidaUtilDias: null, conservacion: "Seco y ventilado", alergenos: null,
      estado: "Activo", esEjemplo: true,
    },
    {
      codigo: "MP-GRA-001", tipoArticulo: "MP", descripcionTpv: "Mantequilla 82%", descripcionCompleta: "Mantequilla 82% MG barra 250 g",
      familia: "Grasas y aceites", subfamilia: "Mantequilla", seccion: "General", esComprable: true, esElaborado: false, esVendible: false, llevaReceta: false,
      umBaseStock: "kg", umCompra: "paquete", factorCompraABase: 1, umVenta: null, factorVentaABase: null, pesoNetoUdG: null, formatoPresentacion: "Barra 250 g (pack de 4)",
      costeUmBase: 5.80, mermaEstandarPct: 0.5,
      codIva: "SR4", ivaPct: 4, metodoPrecio: "MARGEN", margenObjetivoPct: null, pvpObjetivoConIva: null, pvpFijoConIva: null, pvpAplicadoConIva: null, pvpAplicadoSinIva: null, margenRealPct: null, desviacionPp: null, diferenciaEurUd: null, diagnosticoPrecio: null,
      controlaStock: "SI", metodoValoracion: "FIFO", stockMinimo: 10, stockMaximo: 50, puntoPedido: 20, ubicacion: "Cámara refrigeración", claseAbc: "A",
      controlLote: "SI", vidaUtilDias: 60, conservacion: "Refrigerado (0-4 C)", alergenos: "Leche",
      estado: "Activo", esEjemplo: true,
    },
    {
      codigo: "MP-GRA-002", tipoArticulo: "MP", descripcionTpv: "Margarina hojaldre", descripcionCompleta: "Margarina hojaldre técnica 1 kg",
      familia: "Grasas y aceites", subfamilia: "Margarina", seccion: "General", esComprable: true, esElaborado: false, esVendible: false, llevaReceta: false,
      umBaseStock: "kg", umCompra: "paquete", factorCompraABase: 1, umVenta: null, factorVentaABase: null, pesoNetoUdG: null, formatoPresentacion: "Barra 1 kg",
      costeUmBase: 3.90, mermaEstandarPct: 0,
      codIva: "SR4", ivaPct: 4, metodoPrecio: "MARGEN", margenObjetivoPct: null, pvpObjetivoConIva: null, pvpFijoConIva: null, pvpAplicadoConIva: null, pvpAplicadoSinIva: null, margenRealPct: null, desviacionPp: null, diferenciaEurUd: null, diagnosticoPrecio: null,
      controlaStock: "SI", metodoValoracion: "FIFO", stockMinimo: 10, stockMaximo: 40, puntoPedido: 15, ubicacion: "Cámara refrigeración", claseAbc: "B",
      controlLote: "SI", vidaUtilDias: 90, conservacion: "Refrigerado (0-4 C)", alergenos: null,
      estado: "Activo", esEjemplo: true,
    },
    {
      codigo: "MP-LAC-001", tipoArticulo: "MP", descripcionTpv: "Leche entera UHT", descripcionCompleta: "Leche entera UHT brick 1 l",
      familia: "Lácteos y huevos", subfamilia: "Leche", seccion: "General", esComprable: true, esElaborado: false, esVendible: false, llevaReceta: false,
      umBaseStock: "l", umCompra: "caja", factorCompraABase: 12, umVenta: null, factorVentaABase: null, pesoNetoUdG: null, formatoPresentacion: "Caja 12 × 1 l",
      costeUmBase: 0.85, mermaEstandarPct: 0,
      codIva: "SR4", ivaPct: 4, metodoPrecio: "MARGEN", margenObjetivoPct: null, pvpObjetivoConIva: null, pvpFijoConIva: null, pvpAplicadoConIva: null, pvpAplicadoSinIva: null, margenRealPct: null, desviacionPp: null, diferenciaEurUd: null, diagnosticoPrecio: null,
      controlaStock: "SI", metodoValoracion: "PMP", stockMinimo: 12, stockMaximo: 48, puntoPedido: 24, ubicacion: "Almacén seco", claseAbc: "B",
      controlLote: "SI", vidaUtilDias: 180, conservacion: "Seco y ventilado", alergenos: "Leche",
      estado: "Activo", esEjemplo: true,
    },
    {
      codigo: "MP-LAC-002", tipoArticulo: "MP", descripcionTpv: "Nata 35% MG", descripcionCompleta: "Nata para montar 35% MG brick 1 l",
      familia: "Lácteos y huevos", subfamilia: "Nata", seccion: "General", esComprable: true, esElaborado: false, esVendible: false, llevaReceta: false,
      umBaseStock: "l", umCompra: "caja", factorCompraABase: 12, umVenta: null, factorVentaABase: null, pesoNetoUdG: null, formatoPresentacion: "Caja 12 × 1 l",
      costeUmBase: 2.10, mermaEstandarPct: 0.5,
      codIva: "SR4", ivaPct: 4, metodoPrecio: "MARGEN", margenObjetivoPct: null, pvpObjetivoConIva: null, pvpFijoConIva: null, pvpAplicadoConIva: null, pvpAplicadoSinIva: null, margenRealPct: null, desviacionPp: null, diferenciaEurUd: null, diagnosticoPrecio: null,
      controlaStock: "SI", metodoValoracion: "FIFO", stockMinimo: 6, stockMaximo: 24, puntoPedido: 12, ubicacion: "Cámara refrigeración", claseAbc: "A",
      controlLote: "SI", vidaUtilDias: 30, conservacion: "Refrigerado (0-4 C)", alergenos: "Leche",
      estado: "Activo", esEjemplo: true,
    },
    {
      codigo: "MP-LAC-003", tipoArticulo: "MP", descripcionTpv: "Huevo líquido past.", descripcionCompleta: "Huevo líquido pasteurizado 1 kg",
      familia: "Lácteos y huevos", subfamilia: "Huevo", seccion: "General", esComprable: true, esElaborado: false, esVendible: false, llevaReceta: false,
      umBaseStock: "kg", umCompra: "caja", factorCompraABase: 6, umVenta: null, factorVentaABase: null, pesoNetoUdG: null, formatoPresentacion: "Caja 6 × 1 kg",
      costeUmBase: 3.50, mermaEstandarPct: 0,
      codIva: "SR4", ivaPct: 4, metodoPrecio: "MARGEN", margenObjetivoPct: null, pvpObjetivoConIva: null, pvpFijoConIva: null, pvpAplicadoConIva: null, pvpAplicadoSinIva: null, margenRealPct: null, desviacionPp: null, diferenciaEurUd: null, diagnosticoPrecio: null,
      controlaStock: "SI", metodoValoracion: "FIFO", stockMinimo: 6, stockMaximo: 18, puntoPedido: 8, ubicacion: "Cámara refrigeración", claseAbc: "B",
      controlLote: "SI", vidaUtilDias: 14, conservacion: "Refrigerado (0-4 C)", alergenos: "Huevos",
      estado: "Activo", esEjemplo: true,
    },
    {
      codigo: "MP-CHO-001", tipoArticulo: "MP", descripcionTpv: "Cobertura negra 55%", descripcionCompleta: "Cobertura negra 55% cacao 5 kg",
      familia: "Chocolates y coberturas", subfamilia: "Cobertura", seccion: "General", esComprable: true, esElaborado: false, esVendible: false, llevaReceta: false,
      umBaseStock: "kg", umCompra: "paquete", factorCompraABase: 5, umVenta: null, factorVentaABase: null, pesoNetoUdG: null, formatoPresentacion: "Tableta 5 kg",
      costeUmBase: 8.90, mermaEstandarPct: 1.0,
      codIva: "RD10", ivaPct: 10, metodoPrecio: "MARGEN", margenObjetivoPct: null, pvpObjetivoConIva: null, pvpFijoConIva: null, pvpAplicadoConIva: null, pvpAplicadoSinIva: null, margenRealPct: null, desviacionPp: null, diferenciaEurUd: null, diagnosticoPrecio: null,
      controlaStock: "SI", metodoValoracion: "FIFO", stockMinimo: 5, stockMaximo: 20, puntoPedido: 8, ubicacion: "Almacén seco", claseAbc: "A",
      controlLote: "SI", vidaUtilDias: 365, conservacion: "Seco y ventilado", alergenos: "Leche",
      estado: "Activo", esEjemplo: true,
    },
    {
      codigo: "MP-FRU-001", tipoArticulo: "MP", descripcionTpv: "Almendra molida", descripcionCompleta: "Almendra molida 500 g",
      familia: "Frutas y frutos secos", subfamilia: "Frutos secos", seccion: "General", esComprable: true, esElaborado: false, esVendible: false, llevaReceta: false,
      umBaseStock: "kg", umCompra: "paquete", factorCompraABase: 1, umVenta: null, factorVentaABase: null, pesoNetoUdG: null, formatoPresentacion: "Bolsa 500 g",
      costeUmBase: 9.50, mermaEstandarPct: 0,
      codIva: "RD10", ivaPct: 10, metodoPrecio: "MARGEN", margenObjetivoPct: null, pvpObjetivoConIva: null, pvpFijoConIva: null, pvpAplicadoConIva: null, pvpAplicadoSinIva: null, margenRealPct: null, desviacionPp: null, diferenciaEurUd: null, diagnosticoPrecio: null,
      controlaStock: "SI", metodoValoracion: "FIFO", stockMinimo: 2, stockMaximo: 10, puntoPedido: 4, ubicacion: "Almacén seco", claseAbc: "B",
      controlLote: "SI", vidaUtilDias: 180, conservacion: "Seco y ventilado", alergenos: "Frutos de cáscara",
      estado: "Activo", esEjemplo: true,
    },
    {
      codigo: "IN-ENV-001", tipoArticulo: "IN", descripcionTpv: "Bolsa papel antigrasa", descripcionCompleta: "Bolsa papel antigrasa 20×30 cm",
      familia: "Envases y embalajes", subfamilia: "Bolsas y papel", seccion: "General", esComprable: true, esElaborado: false, esVendible: false, llevaReceta: false,
      umBaseStock: "ud", umCompra: "paquete", factorCompraABase: 500, umVenta: null, factorVentaABase: null, pesoNetoUdG: null, formatoPresentacion: "Paquete 500 unidades",
      costeUmBase: 0.024, mermaEstandarPct: 2.0,
      codIva: "RD10", ivaPct: 10, metodoPrecio: "MARGEN", margenObjetivoPct: null, pvpObjetivoConIva: null, pvpFijoConIva: null, pvpAplicadoConIva: null, pvpAplicadoSinIva: null, margenRealPct: null, desviacionPp: null, diferenciaEurUd: null, diagnosticoPrecio: null,
      controlaStock: "SI", metodoValoracion: "PMP", stockMinimo: 500, stockMaximo: 2000, puntoPedido: 800, ubicacion: "Trastienda", claseAbc: "C",
      controlLote: "NO", vidaUtilDias: null, conservacion: "Seco y ventilado", alergenos: null,
      estado: "Activo", esEjemplo: true,
    },
    {
      codigo: "IN-ENV-002", tipoArticulo: "IN", descripcionTpv: "Caja tarta 26 cm", descripcionCompleta: "Caja tarta redonda 26 cm cartón",
      familia: "Envases y embalajes", subfamilia: "Cajas", seccion: "General", esComprable: true, esElaborado: false, esVendible: false, llevaReceta: false,
      umBaseStock: "ud", umCompra: "paquete", factorCompraABase: 50, umVenta: null, factorVentaABase: null, pesoNetoUdG: null, formatoPresentacion: "Paquete 50 unidades",
      costeUmBase: 0.45, mermaEstandarPct: 0,
      codIva: "RD10", ivaPct: 10, metodoPrecio: "MARGEN", margenObjetivoPct: null, pvpObjetivoConIva: null, pvpFijoConIva: null, pvpAplicadoConIva: null, pvpAplicadoSinIva: null, margenRealPct: null, desviacionPp: null, diferenciaEurUd: null, diagnosticoPrecio: null,
      controlaStock: "SI", metodoValoracion: "PMP", stockMinimo: 50, stockMaximo: 300, puntoPedido: 100, ubicacion: "Trastienda", claseAbc: "C",
      controlLote: "NO", vidaUtilDias: null, conservacion: "Seco y ventilado", alergenos: null,
      estado: "Activo", esEjemplo: true,
    },
    {
      codigo: "IN-ENV-003", tipoArticulo: "IN", descripcionTpv: "Etiqueta ingredientes", descripcionCompleta: "Etiqueta ingredientes autoadhesiva",
      familia: "Envases y embalajes", subfamilia: "Etiquetas", seccion: "General", esComprable: true, esElaborado: false, esVendible: false, llevaReceta: false,
      umBaseStock: "ud", umCompra: "paquete", factorCompraABase: 1000, umVenta: null, factorVentaABase: null, pesoNetoUdG: null, formatoPresentacion: "Rollo 1000 etiquetas",
      costeUmBase: 0.008, mermaEstandarPct: 3.0,
      codIva: "RD10", ivaPct: 10, metodoPrecio: "MARGEN", margenObjetivoPct: null, pvpObjetivoConIva: null, pvpFijoConIva: null, pvpAplicadoConIva: null, pvpAplicadoSinIva: null, margenRealPct: null, desviacionPp: null, diferenciaEurUd: null, diagnosticoPrecio: null,
      controlaStock: "SI", metodoValoracion: "PMP", stockMinimo: 200, stockMaximo: 2000, puntoPedido: 500, ubicacion: "Trastienda", claseAbc: "C",
      controlLote: "NO", vidaUtilDias: null, conservacion: "Seco y ventilado", alergenos: null,
      estado: "Activo", esEjemplo: true,
    },
    {
      codigo: "SE-SEM-001", tipoArticulo: "SE", descripcionTpv: "Masa madre líquida", descripcionCompleta: "Masa madre líquida de levadura",
      familia: "Semielaborados", subfamilia: "Masas", seccion: "Pastelería/Obrador", esComprable: false, esElaborado: true, esVendible: false, llevaReceta: true,
      umBaseStock: "kg", umCompra: null, factorCompraABase: null, umVenta: null, factorVentaABase: null, pesoNetoUdG: null, formatoPresentacion: "Cubeta 5 kg",
      costeUmBase: null, mermaEstandarPct: 0,
      codIva: "SR4", ivaPct: 4, metodoPrecio: "MARGEN", margenObjetivoPct: null, pvpObjetivoConIva: null, pvpFijoConIva: null, pvpAplicadoConIva: null, pvpAplicadoSinIva: null, margenRealPct: null, desviacionPp: null, diferenciaEurUd: null, diagnosticoPrecio: null,
      controlaStock: "SI", metodoValoracion: "PMP", stockMinimo: 2, stockMaximo: 10, puntoPedido: 3, ubicacion: "Cámara refrigeración", claseAbc: "B",
      controlLote: "SI", vidaUtilDias: 3, conservacion: "Refrigerado (0-4 C)", alergenos: "Gluten",
      estado: "Activo", esEjemplo: true,
    },
    {
      codigo: "SE-SEM-002", tipoArticulo: "SE", descripcionTpv: "Masa hojaldre", descripcionCompleta: "Masa de hojaldre laminada",
      familia: "Semielaborados", subfamilia: "Masas", seccion: "Pastelería/Obrador", esComprable: false, esElaborado: true, esVendible: false, llevaReceta: true,
      umBaseStock: "kg", umCompra: null, factorCompraABase: null, umVenta: null, factorVentaABase: null, pesoNetoUdG: null, formatoPresentacion: "Plancha 2 kg",
      costeUmBase: null, mermaEstandarPct: 5.0,
      codIva: "SR4", ivaPct: 4, metodoPrecio: "MARGEN", margenObjetivoPct: null, pvpObjetivoConIva: null, pvpFijoConIva: null, pvpAplicadoConIva: null, pvpAplicadoSinIva: null, margenRealPct: null, desviacionPp: null, diferenciaEurUd: null, diagnosticoPrecio: null,
      controlaStock: "SI", metodoValoracion: "FIFO", stockMinimo: 5, stockMaximo: 20, puntoPedido: 8, ubicacion: "Congelador", claseAbc: "A",
      controlLote: "SI", vidaUtilDias: 30, conservacion: "Congelado (-18 C)", alergenos: "Gluten; Leche",
      estado: "Activo", esEjemplo: true,
    },
    {
      codigo: "SE-SEM-003", tipoArticulo: "SE", descripcionTpv: "Crema pastelera", descripcionCompleta: "Crema pastelera de vainilla",
      familia: "Semielaborados", subfamilia: "Cremas y rellenos", seccion: "Pastelería/Obrador", esComprable: false, esElaborado: true, esVendible: false, llevaReceta: true,
      umBaseStock: "kg", umCompra: null, factorCompraABase: null, umVenta: null, factorVentaABase: null, pesoNetoUdG: null, formatoPresentacion: "Cubeta 5 kg",
      costeUmBase: null, mermaEstandarPct: 1.0,
      codIva: "SR4", ivaPct: 4, metodoPrecio: "MARGEN", margenObjetivoPct: null, pvpObjetivoConIva: null, pvpFijoConIva: null, pvpAplicadoConIva: null, pvpAplicadoSinIva: null, margenRealPct: null, desviacionPp: null, diferenciaEurUd: null, diagnosticoPrecio: null,
      controlaStock: "SI", metodoValoracion: "PMP", stockMinimo: 3, stockMaximo: 10, puntoPedido: 5, ubicacion: "Cámara refrigeración", claseAbc: "B",
      controlLote: "SI", vidaUtilDias: 3, conservacion: "Refrigerado (0-4 C)", alergenos: "Gluten; Huevos; Leche",
      estado: "Activo", esEjemplo: true,
    },
    {
      codigo: "SE-SEM-004", tipoArticulo: "SE", descripcionTpv: "Plancha bizcocho", descripcionCompleta: "Plancha bizcocho genovés 60×40 cm",
      familia: "Semielaborados", subfamilia: "Bizcochos", seccion: "Pastelería/Obrador", esComprable: false, esElaborado: true, esVendible: false, llevaReceta: true,
      umBaseStock: "ud", umCompra: null, factorCompraABase: null, umVenta: null, factorVentaABase: null, pesoNetoUdG: null, formatoPresentacion: "Plancha industrial",
      costeUmBase: null, mermaEstandarPct: 3.0,
      codIva: "RD10", ivaPct: 10, metodoPrecio: "MARGEN", margenObjetivoPct: null, pvpObjetivoConIva: null, pvpFijoConIva: null, pvpAplicadoConIva: null, pvpAplicadoSinIva: null, margenRealPct: null, desviacionPp: null, diferenciaEurUd: null, diagnosticoPrecio: null,
      controlaStock: "SI", metodoValoracion: "PMP", stockMinimo: 2, stockMaximo: 6, puntoPedido: 3, ubicacion: "Obrador", claseAbc: "B",
      controlLote: "SI", vidaUtilDias: 2, conservacion: "Ambiente", alergenos: "Gluten; Huevos; Leche",
      estado: "Activo", esEjemplo: true,
    },
    {
      codigo: "PT-PAN-001", tipoArticulo: "PT", descripcionTpv: "Barra rústica 250 g", descripcionCompleta: "Barra rústica de masa madre 250 g",
      familia: "Pan", subfamilia: "Barra", seccion: "Panadería", esComprable: false, esElaborado: true, esVendible: true, llevaReceta: true,
      umBaseStock: "ud", umCompra: null, factorCompraABase: null, umVenta: "ud", factorVentaABase: 1, pesoNetoUdG: 250, formatoPresentacion: "Pieza individual",
      costeUmBase: 0.35, mermaEstandarPct: 1.0,
      codIva: "SR4", ivaPct: 4, metodoPrecio: "FIJO", margenObjetivoPct: 70, pvpObjetivoConIva: 1.19, pvpFijoConIva: 1.20, pvpAplicadoConIva: 1.20, pvpAplicadoSinIva: 1.1538, margenRealPct: 69.65, desviacionPp: -0.35, diferenciaEurUd: 0.01, diagnosticoPrecio: "EN OBJETIVO",
      controlaStock: "SI", metodoValoracion: "PMP", stockMinimo: 0, stockMaximo: 500, puntoPedido: null, ubicacion: "Tienda / vitrina", claseAbc: "A",
      controlLote: "SI", vidaUtilDias: 1, conservacion: "Ambiente", alergenos: "Gluten",
      estado: "Activo", esEjemplo: true,
    },
    {
      codigo: "PT-PAN-002", tipoArticulo: "PT", descripcionTpv: "Hogaza integral 500g", descripcionCompleta: "Hogaza integral 500 g con semillas",
      familia: "Pan", subfamilia: "Hogaza", seccion: "Panadería", esComprable: false, esElaborado: true, esVendible: true, llevaReceta: true,
      umBaseStock: "ud", umCompra: null, factorCompraABase: null, umVenta: "ud", factorVentaABase: 1, pesoNetoUdG: 500, formatoPresentacion: "Pieza individual",
      costeUmBase: 0.65, mermaEstandarPct: 1.0,
      codIva: "SR4", ivaPct: 4, metodoPrecio: "FIJO", margenObjetivoPct: 70, pvpObjetivoConIva: 2.38, pvpFijoConIva: 2.40, pvpAplicadoConIva: 2.40, pvpAplicadoSinIva: 2.3077, margenRealPct: 71.84, desviacionPp: 1.84, diferenciaEurUd: 0.02, diagnosticoPrecio: "EN OBJETIVO",
      controlaStock: "SI", metodoValoracion: "PMP", stockMinimo: 0, stockMaximo: 200, puntoPedido: null, ubicacion: "Tienda / vitrina", claseAbc: "B",
      controlLote: "SI", vidaUtilDias: 1, conservacion: "Ambiente", alergenos: "Gluten",
      estado: "Activo", esEjemplo: true,
    },
    {
      codigo: "PT-PAN-003", tipoArticulo: "PT", descripcionTpv: "Chapata 200 g", descripcionCompleta: "Chapata 200 g con masa madre",
      familia: "Pan", subfamilia: "Chapata", seccion: "Panadería", esComprable: false, esElaborado: true, esVendible: true, llevaReceta: true,
      umBaseStock: "ud", umCompra: null, factorCompraABase: null, umVenta: "ud", factorVentaABase: 1, pesoNetoUdG: 200, formatoPresentacion: "Pieza individual",
      costeUmBase: 0.30, mermaEstandarPct: 1.0,
      codIva: "SR4", ivaPct: 4, metodoPrecio: "FIJO", margenObjetivoPct: 70, pvpObjetivoConIva: 1.05, pvpFijoConIva: 1.10, pvpAplicadoConIva: 1.10, pvpAplicadoSinIva: 1.0577, margenRealPct: 71.64, desviacionPp: 1.64, diferenciaEurUd: 0.05, diagnosticoPrecio: "EN OBJETIVO",
      controlaStock: "SI", metodoValoracion: "PMP", stockMinimo: 0, stockMaximo: 300, puntoPedido: null, ubicacion: "Tienda / vitrina", claseAbc: "A",
      controlLote: "SI", vidaUtilDias: 1, conservacion: "Ambiente", alergenos: "Gluten",
      estado: "Activo", esEjemplo: true,
    },
    {
      codigo: "PT-PAN-004", tipoArticulo: "PT", descripcionTpv: "Pan molde 750 g", descripcionCompleta: "Pan de molde 750 g laminado",
      familia: "Pan", subfamilia: "Pan de molde", seccion: "Panadería", esComprable: false, esElaborado: true, esVendible: true, llevaReceta: true,
      umBaseStock: "ud", umCompra: null, factorCompraABase: null, umVenta: "ud", factorVentaABase: 1, pesoNetoUdG: 750, formatoPresentacion: "Barra molde",
      costeUmBase: 0.45, mermaEstandarPct: 1.0,
      codIva: "SR4", ivaPct: 4, metodoPrecio: "FIJO", margenObjetivoPct: 60, pvpObjetivoConIva: 1.20, pvpFijoConIva: 1.20, pvpAplicadoConIva: 1.20, pvpAplicadoSinIva: 1.1538, margenRealPct: 60.98, desviacionPp: 0.98, diferenciaEurUd: 0.00, diagnosticoPrecio: "EN OBJETIVO",
      controlaStock: "SI", metodoValoracion: "PMP", stockMinimo: 0, stockMaximo: 200, puntoPedido: null, ubicacion: "Tienda / vitrina", claseAbc: "B",
      controlLote: "SI", vidaUtilDias: 3, conservacion: "Ambiente", alergenos: "Gluten",
      estado: "Activo", esEjemplo: true,
    },
    {
      codigo: "PT-BOL-001", tipoArticulo: "PT", descripcionTpv: "Croissant mantequilla", descripcionCompleta: "Croissant de mantequilla artesanal",
      familia: "Bollería", subfamilia: "Croissantería", seccion: "Pastelería/Obrador", esComprable: false, esElaborado: true, esVendible: true, llevaReceta: true,
      umBaseStock: "ud", umCompra: null, factorCompraABase: null, umVenta: "ud", factorVentaABase: 1, pesoNetoUdG: 80, formatoPresentacion: "Pieza individual",
      costeUmBase: 0.25, mermaEstandarPct: 2.0,
      codIva: "RD10", ivaPct: 10, metodoPrecio: "FIJO", margenObjetivoPct: 65, pvpObjetivoConIva: 0.79, pvpFijoConIva: 0.80, pvpAplicadoConIva: 0.80, pvpAplicadoSinIva: 0.7273, margenRealPct: 65.63, desviacionPp: 0.63, diferenciaEurUd: 0.01, diagnosticoPrecio: "EN OBJETIVO",
      controlaStock: "SI", metodoValoracion: "PMP", stockMinimo: 0, stockMaximo: 100, puntoPedido: null, ubicacion: "Tienda / vitrina", claseAbc: "A",
      controlLote: "NO", vidaUtilDias: 1, conservacion: "Ambiente", alergenos: "Gluten; Huevos; Leche",
      estado: "Activo", esEjemplo: true,
    },
    {
      codigo: "PT-BOL-002", tipoArticulo: "PT", descripcionTpv: "Napolitana chocolate", descripcionCompleta: "Napolitana de chocolate 100 g",
      familia: "Bollería", subfamilia: "Hojaldre", seccion: "Pastelería/Obrador", esComprable: false, esElaborado: true, esVendible: true, llevaReceta: true,
      umBaseStock: "ud", umCompra: null, factorCompraABase: null, umVenta: "ud", factorVentaABase: 1, pesoNetoUdG: 100, formatoPresentacion: "Pieza individual",
      costeUmBase: 0.30, mermaEstandarPct: 2.0,
      codIva: "RD10", ivaPct: 10, metodoPrecio: "FIJO", margenObjetivoPct: 65, pvpObjetivoConIva: 0.95, pvpFijoConIva: 0.95, pvpAplicadoConIva: 0.95, pvpAplicadoSinIva: 0.8636, margenRealPct: 65.26, desviacionPp: 0.26, diferenciaEurUd: 0.00, diagnosticoPrecio: "EN OBJETIVO",
      controlaStock: "SI", metodoValoracion: "PMP", stockMinimo: 0, stockMaximo: 80, puntoPedido: null, ubicacion: "Tienda / vitrina", claseAbc: "A",
      controlLote: "NO", vidaUtilDias: 1, conservacion: "Ambiente", alergenos: "Gluten; Huevos; Leche",
      estado: "Activo", esEjemplo: true,
    },
    {
      codigo: "PT-BOL-003", tipoArticulo: "PT", descripcionTpv: "Magdalena artesana", descripcionCompleta: "Magdalena artesana de vainilla 60 g",
      familia: "Bollería", subfamilia: "Magdalenas y muffins", seccion: "Pastelería/Obrador", esComprable: false, esElaborado: true, esVendible: true, llevaReceta: true,
      umBaseStock: "ud", umCompra: null, factorCompraABase: null, umVenta: "ud", factorVentaABase: 1, pesoNetoUdG: 60, formatoPresentacion: "Pieza individual",
      costeUmBase: 0.15, mermaEstandarPct: 2.0,
      codIva: "RD10", ivaPct: 10, metodoPrecio: "FIJO", margenObjetivoPct: 60, pvpObjetivoConIva: 0.42, pvpFijoConIva: 0.40, pvpAplicadoConIva: 0.40, pvpAplicadoSinIva: 0.3636, margenRealPct: 58.74, desviacionPp: -1.26, diferenciaEurUd: -0.02, diagnosticoPrecio: "AJUSTADO",
      controlaStock: "SI", metodoValoracion: "PMP", stockMinimo: 0, stockMaximo: 60, puntoPedido: null, ubicacion: "Tienda / vitrina", claseAbc: "B",
      controlLote: "NO", vidaUtilDias: 1, conservacion: "Ambiente", alergenos: "Gluten; Huevos; Leche",
      estado: "Activo", esEjemplo: true,
    },
    {
      codigo: "PT-PAS-001", tipoArticulo: "PT", descripcionTpv: "Palmera hojaldre", descripcionCompleta: "Palmera de hojaldre glazed 80 g",
      familia: "Pastelería", subfamilia: "Hojaldre", seccion: "Pastelería/Obrador", esComprable: false, esElaborado: true, esVendible: true, llevaReceta: true,
      umBaseStock: "ud", umCompra: null, factorCompraABase: null, umVenta: "ud", factorVentaABase: 1, pesoNetoUdG: 80, formatoPresentacion: "Pieza individual",
      costeUmBase: 0.20, mermaEstandarPct: 2.0,
      codIva: "RD10", ivaPct: 10, metodoPrecio: "FIJO", margenObjetivoPct: 60, pvpObjetivoConIva: 0.56, pvpFijoConIva: 0.55, pvpAplicadoConIva: 0.55, pvpAplicadoSinIva: 0.50, margenRealPct: 60.00, desviacionPp: 0.00, diferenciaEurUd: -0.01, diagnosticoPrecio: "EN OBJETIVO",
      controlaStock: "SI", metodoValoracion: "PMP", stockMinimo: 0, stockMaximo: 60, puntoPedido: null, ubicacion: "Tienda / vitrina", claseAbc: "B",
      controlLote: "NO", vidaUtilDias: 1, conservacion: "Ambiente", alergenos: "Gluten; Leche",
      estado: "Activo", esEjemplo: true,
    },
    {
      codigo: "PT-TAR-001", tipoArticulo: "PT", descripcionTpv: "Tarta queso porción", descripcionCompleta: "Tarta de queso porción 120 g",
      familia: "Tartas", subfamilia: "Tarta por porción", seccion: "Pastelería/Obrador", esComprable: false, esElaborado: true, esVendible: true, llevaReceta: true,
      umBaseStock: "porción", umCompra: null, factorCompraABase: null, umVenta: "porción", factorVentaABase: 1, pesoNetoUdG: 120, formatoPresentacion: "Porción individual envasada",
      costeUmBase: 0.80, mermaEstandarPct: 3.0,
      codIva: "RD10", ivaPct: 10, metodoPrecio: "FIJO", margenObjetivoPct: 70, pvpObjetivoConIva: 2.93, pvpFijoConIva: 2.90, pvpAplicadoConIva: 2.90, pvpAplicadoSinIva: 2.6364, margenRealPct: 69.65, desviacionPp: -0.35, diferenciaEurUd: -0.03, diagnosticoPrecio: "EN OBJETIVO",
      controlaStock: "SI", metodoValoracion: "PMP", stockMinimo: 0, stockMaximo: 30, puntoPedido: null, ubicacion: "Tienda / vitrina", claseAbc: "A",
      controlLote: "SI", vidaUtilDias: 3, conservacion: "Refrigerado (0-4 C)", alergenos: "Gluten; Huevos; Leche",
      estado: "Activo", esEjemplo: true,
    },
    {
      codigo: "PT-TAR-002", tipoArticulo: "PT", descripcionTpv: "Tarta Sacher 24cm", descripcionCompleta: "Tarta Sacher entera 24 cm chocolate",
      familia: "Tartas", subfamilia: "Tarta entera", seccion: "Pastelería/Obrador", esComprable: false, esElaborado: true, esVendible: true, llevaReceta: true,
      umBaseStock: "ud", umCompra: null, factorCompraABase: null, umVenta: "ud", factorVentaABase: 1, pesoNetoUdG: 1200, formatoPresentacion: "Tarta entera 24 cm",
      costeUmBase: 5.50, mermaEstandarPct: 3.0,
      codIva: "RD10", ivaPct: 10, metodoPrecio: "FIJO", margenObjetivoPct: 70, pvpObjetivoConIva: 20.33, pvpFijoConIva: 20.00, pvpAplicadoConIva: 20.00, pvpAplicadoSinIva: 18.1818, margenRealPct: 69.75, desviacionPp: -0.25, diferenciaEurUd: -0.33, diagnosticoPrecio: "EN OBJETIVO",
      controlaStock: "SI", metodoValoracion: "PMP", stockMinimo: 0, stockMaximo: 10, puntoPedido: null, ubicacion: "Cámara refrigeración", claseAbc: "B",
      controlLote: "SI", vidaUtilDias: 5, conservacion: "Refrigerado (0-4 C)", alergenos: "Gluten; Huevos; Leche",
      estado: "Activo", esEjemplo: true,
    },
    {
      codigo: "PT-SLD-001", tipoArticulo: "PT", descripcionTpv: "Empanada atún", descripcionCompleta: "Empanada de atún porción 150 g",
      familia: "Salados", subfamilia: "Empanadas", seccion: "Salados", esComprable: false, esElaborado: true, esVendible: true, llevaReceta: true,
      umBaseStock: "porción", umCompra: null, factorCompraABase: null, umVenta: "porción", factorVentaABase: 1, pesoNetoUdG: 150, formatoPresentacion: "Porción individual",
      costeUmBase: 0.55, mermaEstandarPct: 2.0,
      codIva: "RD10", ivaPct: 10, metodoPrecio: "FIJO", margenObjetivoPct: 65, pvpObjetivoConIva: 1.74, pvpFijoConIva: 1.75, pvpAplicadoConIva: 1.75, pvpAplicadoSinIva: 1.5909, margenRealPct: 65.42, desviacionPp: 0.42, diferenciaEurUd: 0.01, diagnosticoPrecio: "EN OBJETIVO",
      controlaStock: "SI", metodoValoracion: "PMP", stockMinimo: 0, stockMaximo: 40, puntoPedido: null, ubicacion: "Tienda / vitrina", claseAbc: "B",
      controlLote: "SI", vidaUtilDias: 2, conservacion: "Refrigerado (0-4 C)", alergenos: "Gluten; Pescado; Huevos",
      estado: "Activo", esEjemplo: true,
    },
    {
      codigo: "RV-CAF-001", tipoArticulo: "RV", descripcionTpv: "Café grano natural", descripcionCompleta: "Café en grano natural tueste medio 1 kg",
      familia: "Cafetería", subfamilia: "Café", seccion: "Cafetería", esComprable: true, esElaborado: false, esVendible: true, llevaReceta: false,
      umBaseStock: "kg", umCompra: "paquete", factorCompraABase: 1, umVenta: "kg", factorVentaABase: 1, pesoNetoUdG: null, formatoPresentacion: "Bolsa 1 kg",
      costeUmBase: 12.00, mermaEstandarPct: 0,
      codIva: "RD10", ivaPct: 10, metodoPrecio: "MARGEN", margenObjetivoPct: null, pvpObjetivoConIva: null, pvpFijoConIva: null, pvpAplicadoConIva: null, pvpAplicadoSinIva: null, margenRealPct: null, desviacionPp: null, diferenciaEurUd: null, diagnosticoPrecio: null,
      controlaStock: "SI", metodoValoracion: "PMP", stockMinimo: 5, stockMaximo: 20, puntoPedido: 8, ubicacion: "Almacén seco", claseAbc: "A",
      controlLote: "SI", vidaUtilDias: 365, conservacion: "Seco y ventilado", alergenos: null,
      estado: "Activo", esEjemplo: true,
    },
    {
      codigo: "RV-BEB-001", tipoArticulo: "RV", descripcionTpv: "Agua mineral 50 cl", descripcionCompleta: "Agua mineral natural 50 cl botella",
      familia: "Bebidas", subfamilia: "Agua y zumos", seccion: "Reventa", esComprable: true, esElaborado: false, esVendible: true, llevaReceta: false,
      umBaseStock: "ud", umCompra: "caja", factorCompraABase: 12, umVenta: "ud", factorVentaABase: 1, pesoNetoUdG: null, formatoPresentacion: "Caja 12 × 50 cl",
      costeUmBase: 0.25, mermaEstandarPct: 0,
      codIva: "RD10", ivaPct: 10, metodoPrecio: "FIJO", margenObjetivoPct: 55, pvpObjetivoConIva: 0.62, pvpFijoConIva: 0.90, pvpAplicadoConIva: 0.90, pvpAplicadoSinIva: 0.8182, margenRealPct: 69.44, desviacionPp: 14.44, diferenciaEurUd: 0.28, diagnosticoPrecio: "POR ENCIMA",
      controlaStock: "SI", metodoValoracion: "PMP", stockMinimo: 24, stockMaximo: 120, puntoPedido: 48, ubicacion: "Almacén seco", claseAbc: "B",
      controlLote: "NO", vidaUtilDias: null, conservacion: "Seco y ventilado", alergenos: null,
      estado: "Activo", esEjemplo: true,
    },
    {
      codigo: "RV-BEB-002", tipoArticulo: "RV", descripcionTpv: "Refresco cola lata", descripcionCompleta: "Refresco cola lata 33 cl",
      familia: "Bebidas", subfamilia: "Refrescos", seccion: "Reventa", esComprable: true, esElaborado: false, esVendible: true, llevaReceta: false,
      umBaseStock: "ud", umCompra: "caja", factorCompraABase: 6, umVenta: "ud", factorVentaABase: 1, pesoNetoUdG: null, formatoPresentacion: "Caja 6 × 33 cl",
      costeUmBase: 0.55, mermaEstandarPct: 0,
      codIva: "GN21", ivaPct: 21, metodoPrecio: "FIJO", margenObjetivoPct: 50, pvpObjetivoConIva: 1.23, pvpFijoConIva: 1.60, pvpAplicadoConIva: 1.60, pvpAplicadoSinIva: 1.3223, margenRealPct: 58.41, desviacionPp: 8.41, diferenciaEurUd: 0.37, diagnosticoPrecio: "POR ENCIMA",
      controlaStock: "SI", metodoValoracion: "PMP", stockMinimo: 12, stockMaximo: 60, puntoPedido: 24, ubicacion: "Almacén seco", claseAbc: "B",
      controlLote: "NO", vidaUtilDias: null, conservacion: "Seco y ventilado", alergenos: null,
      estado: "Activo", esEjemplo: true,
    },
  ]

  for (const prod of productos) {
    const pricing = calculateProductPricing({
      costeSinIva: prod.costeUmBase,
      ivaPct: prod.ivaPct,
      pvpVentaConIva: prod.pvpAplicadoConIva,
    })
    await prisma.producto.upsert({
      where: { codigo: prod.codigo },
      update: {},
      create: {
        ...prod,
        ivaCompraPct: pricing.ivaCompraPct,
        ivaVentaPct: pricing.ivaVentaPct,
        costeConIva: pricing.costeConIva,
        pvpAplicadoSinIva: pricing.pvpVentaSinIva,
        gananciaEurUd: pricing.gananciaEurUd,
        margenRealPct: pricing.margenRealPct,
        createdById: null,
      },
    })
  }

  console.log(`  ${productos.length} productos de ejemplo insertados`)

  // Proveedores
  const proveedores = [
    {
      razonSocial: "Harinas del Sur",
      cifNif: "A12345678",
      contactoNombre: "Manuel García",
      contactoTelefono: "950123456",
      contactoEmail: "manuel@harinasdelsur.es",
      direccionFiscal: "Pol. Ind. Los Olivos, C/ Trigo 12, 04120 Almería",
      notasCondiciones: "Proveedor principal de harinas. Entrega los martes y jueves.",
      categoriaServicio: "Harinas y cereales",
      condicionesPago: "Transferencia 30 días",
      plazoEntregaDias: 2,
      estado: "Activo",
      valoracionFiabilidad: 5,
      valoracionCalidad: 4,
      valoracionPrecio: 4,
    },
    {
      razonSocial: "Café Miguel",
      cifNif: "B87654321",
      contactoNombre: "Miguel Torres",
      contactoTelefono: "915678901",
      contactoEmail: "miguel@cafemiguel.com",
      direccionFiscal: "C/ Mayor 45, 28001 Madrid",
      notasCondiciones: "Café en grano y molido. Mínimo pedido 50€.",
      categoriaServicio: "Bebidas",
      condicionesPago: "Efectivo / Bizum",
      plazoEntregaDias: 3,
      estado: "Activo",
      valoracionFiabilidad: 4,
      valoracionCalidad: 5,
      valoracionPrecio: 4,
    },
    {
      razonSocial: "Lácteos La Vega",
      cifNif: "C11223344",
      contactoNombre: "Ana Ruiz",
      contactoTelefono: "945123456",
      contactoEmail: "ana@lacteoslavega.es",
      direccionFiscal: "C/ Pradera 8, 01001 Vitoria-Gasteiz",
      notasCondiciones: "Leche, mantequilla, nata y queso. Entrega diaria excepto domingos.",
      categoriaServicio: "Lácteos",
      condicionesPago: "Transferencia 15 días",
      plazoEntregaDias: 1,
      estado: "Activo",
      valoracionFiabilidad: 5,
      valoracionCalidad: 5,
      valoracionPrecio: 3,
    },
    {
      razonSocial: "Pastas Frescas Don Carlo",
      cifNif: "D55667788",
      contactoNombre: "Carlo Bianchi",
      contactoTelefono: "934567890",
      contactoEmail: "carlo@doncarlo.es",
      direccionFiscal: "C/ Industria 23, 08100 Mollet del Vallès",
      notasCondiciones: "Pastas frescas artesanales. Pedidos mínimos 100€.",
      categoriaServicio: "Pastas y harinas",
      condicionesPago: "Transferencia 30 días",
      plazoEntregaDias: 1,
      estado: "Activo",
      valoracionFiabilidad: 4,
      valoracionCalidad: 5,
      valoracionPrecio: 3,
    },
  ]

  for (const prov of proveedores) {
    await prisma.proveedor.upsert({
      where: { cifNif: prov.cifNif },
      update: {},
      create: prov,
    })
  }

  console.log(`  ${proveedores.length} proveedores insertados`)

  // Asociar proveedores a productos (ProveedorProducto)
  const provHarinas = await prisma.proveedor.findUnique({ where: { cifNif: "A12345678" } })
  const provCafe = await prisma.proveedor.findUnique({ where: { cifNif: "B87654321" } })
  const provLacteos = await prisma.proveedor.findUnique({ where: { cifNif: "C11223344" } })
  const provPastas = await prisma.proveedor.findUnique({ where: { cifNif: "D55667788" } })

  const asociaciones: { codProducto: string; idProveedor: string; refProveedor: string; precioCompraSinIva: number | null; plazoEntregaDias: number | null; pedidoMinimo: number | null; esPrincipal: boolean }[] = []

  // Harinas del Sur → harinas
  if (provHarinas) {
    asociaciones.push(
      { codProducto: "MP-HAR-001", idProveedor: provHarinas.id, refProveedor: "HS-HAR-TRIGO", precioCompraSinIva: 0.38, plazoEntregaDias: 2, pedidoMinimo: 200, esPrincipal: true },
      { codProducto: "MP-HAR-002", idProveedor: provHarinas.id, refProveedor: "HS-HAR-CENT", precioCompraSinIva: 0.50, plazoEntregaDias: 2, pedidoMinimo: 200, esPrincipal: true },
      { codProducto: "MP-HAR-003", idProveedor: provHarinas.id, refProveedor: "HS-HAR-TRIGR", precioCompraSinIva: 0.45, plazoEntregaDias: 2, pedidoMinimo: 200, esPrincipal: true },
      { codProducto: "MP-HAR-004", idProveedor: provHarinas.id, refProveedor: "HS-HAR-MAIZ", precioCompraSinIva: 0.55, plazoEntregaDias: 3, pedidoMinimo: 200, esPrincipal: true },
      { codProducto: "MP-SEL-001", idProveedor: provHarinas.id, refProveedor: "HS-SEL-AVENA", precioCompraSinIva: 0.90, plazoEntregaDias: 2, pedidoMinimo: 150, esPrincipal: true },
      { codProducto: "MP-SEL-002", idProveedor: provHarinas.id, refProveedor: "HS-SEL-SESA", precioCompraSinIva: 1.20, plazoEntregaDias: 2, pedidoMinimo: 150, esPrincipal: true },
      { codProducto: "MP-SEL-003", idProveedor: provHarinas.id, refProveedor: "HS-SEL-CHIA", precioCompraSinIva: 1.80, plazoEntregaDias: 3, pedidoMinimo: 150, esPrincipal: true },
      { codProducto: "MP-SEL-004", idProveedor: provHarinas.id, refProveedor: "HS-SEL-LINO", precioCompraSinIva: 1.00, plazoEntregaDias: 3, pedidoMinimo: 150, esPrincipal: true },
      { codProducto: "EL-PAN-003", idProveedor: provHarinas.id, refProveedor: "HS-PAN-COCIDO", precioCompraSinIva: null, plazoEntregaDias: 2, pedidoMinimo: null, esPrincipal: true },
    )
  }

  // Café Miguel → café
  if (provCafe) {
    asociaciones.push(
      { codProducto: "MP-BEB-001", idProveedor: provCafe.id, refProveedor: "CM-CAF-ARAB", precioCompraSinIva: 18.00, plazoEntregaDias: 3, pedidoMinimo: 50, esPrincipal: true },
      { codProducto: "MP-BEB-002", idProveedor: provCafe.id, refProveedor: "CM-CAF-BOLI", precioCompraSinIva: 12.00, plazoEntregaDias: 3, pedidoMinimo: 50, esPrincipal: true },
      { codProducto: "MP-BEB-004", idProveedor: provCafe.id, refProveedor: "CM-CAF-DES", precioCompraSinIva: 22.00, plazoEntregaDias: 5, pedidoMinimo: 100, esPrincipal: true },
      { codProducto: "MP-BEB-005", idProveedor: provCafe.id, refProveedor: "CM-CAF-CHOC", precioCompraSinIva: 8.50, plazoEntregaDias: 3, pedidoMinimo: 50, esPrincipal: true },
    )
  }

  // Lácteos La Vega → lácteos
  if (provLacteos) {
    asociaciones.push(
      { codProducto: "MP-LAC-001", idProveedor: provLacteos.id, refProveedor: "LLV-LAC-LECH", precioCompraSinIva: 0.80, plazoEntregaDias: 1, pedidoMinimo: 30, esPrincipal: true },
      { codProducto: "MP-LAC-002", idProveedor: provLacteos.id, refProveedor: "LLV-LAC-MANT", precioCompraSinIva: 8.50, plazoEntregaDias: 1, pedidoMinimo: 30, esPrincipal: true },
      { codProducto: "MP-LAC-003", idProveedor: provLacteos.id, refProveedor: "LLV-LAC-NATA", precioCompraSinIva: 6.20, plazoEntregaDias: 1, pedidoMinimo: 30, esPrincipal: true },
      { codProducto: "MP-LAC-004", idProveedor: provLacteos.id, refProveedor: "LLV-LAC-HUEV", precioCompraSinIva: 0.18, plazoEntregaDias: 1, pedidoMinimo: 50, esPrincipal: true },
      { codProducto: "MP-LAC-005", idProveedor: provLacteos.id, refProveedor: "LLV-LAC-MASC", precioCompraSinIva: 9.50, plazoEntregaDias: 2, pedidoMinimo: 20, esPrincipal: true },
    )
  }

  // Pastas Frescas Don Carlo → pastas
  if (provPastas) {
    asociaciones.push(
      { codProducto: "EL-PAN-001", idProveedor: provPastas.id, refProveedor: "DC-PAN-BAGU", precioCompraSinIva: null, plazoEntregaDias: 1, pedidoMinimo: null, esPrincipal: false },
      { codProducto: "EL-PAN-002", idProveedor: provPastas.id, refProveedor: "DC-PAN-CIOC", precioCompraSinIva: null, plazoEntregaDias: 1, pedidoMinimo: null, esPrincipal: false },
    )
  }

  for (const asoc of asociaciones) {
    const prod = await prisma.producto.findUnique({ where: { codigo: asoc.codProducto } })
    if (prod) {
      await prisma.proveedorProducto.upsert({
        where: { proveedorId_productoId: { proveedorId: asoc.idProveedor, productoId: prod.id } },
        update: {},
        create: {
          productoId: prod.id,
          proveedorId: asoc.idProveedor,
          refProveedor: asoc.refProveedor,
          precioCompraSinIva: asoc.precioCompraSinIva,
          plazoEntregaDias: asoc.plazoEntregaDias,
          pedidoMinimo: asoc.pedidoMinimo,
          esPrincipal: asoc.esPrincipal,
        },
      })
    }
  }

  console.log(`  ${asociaciones.length} asociaciones producto-proveedor insertadas`)

  const categoriasPago = [
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
  for (const [codigo, nombre, descripcion] of categoriasPago) {
    await prisma.categoriaGasto.upsert({ where: { codigo }, update: { nombre, descripcion }, create: { codigo, nombre, descripcion } })
  }

  const mediosPago = [
    { id: "MP-TRANSF", tipo: "TRANSFERENCIA" as const, requiereCuenta: true, conciliableBanco: true },
    { id: "MP-DOMIC", tipo: "DOMICILIACION" as const, requiereCuenta: true, conciliableBanco: true },
    { id: "MP-TARJ", tipo: "TARJETA" as const, requiereCuenta: true, conciliableBanco: true },
    { id: "MP-EFECT", tipo: "EFECTIVO" as const, requiereCuenta: true, conciliableBanco: false },
    { id: "MP-CHEQUE", tipo: "CHEQUE" as const, requiereCuenta: true, conciliableBanco: true },
    { id: "MP-MOVIL", tipo: "PAGO_MOVIL" as const, requiereCuenta: true, conciliableBanco: true },
  ]
  for (const medio of mediosPago) {
    await prisma.medioPago.upsert({ where: { id: medio.id }, update: medio, create: medio })
  }

  for (const proveedor of await prisma.proveedor.findMany({ select: { id: true, razonSocial: true, cifNif: true } })) {
    await prisma.acreedor.upsert({
      where: { proveedorId: proveedor.id },
      update: { nombre: proveedor.razonSocial, nif: proveedor.cifNif },
      create: { codigo: `PRV-${proveedor.id.slice(-8).toUpperCase()}`, tipo: "PROVEEDOR_MERCANCIA", nombre: proveedor.razonSocial, nif: proveedor.cifNif, proveedorId: proveedor.id },
    })
  }

  console.log(`  ${categoriasPago.length} categorías, ${mediosPago.length} medios y acreedores de proveedores preparados`)
  console.log("Seed completado.")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
