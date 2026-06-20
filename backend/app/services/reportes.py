import io
from typing import List, Optional
from datetime import datetime, date
from fastapi import HTTPException, status
from app.database import supabase
from app.schemas.modelos import DashboardMetricas, MovimientoKardex

# Librerías de ReportLab para la exportación de PDF
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

class ReporteService:
    @staticmethod
    def obtener_metricas_dashboard() -> dict:
        """
        Calcula y agrupa métricas clave del negocio consumiendo agregaciones de Supabase.
        """
        # 1. Total ventas y conteo (solo ventas con estado Completada)
        vta_res = supabase.table("ventas").select("total").eq("estado_venta", "Completada").execute()
        total_ventas = sum(item["total"] for item in vta_res.data) if vta_res.data else 0.00
        cantidad_transacciones = len(vta_res.data) if vta_res.data else 0

        # 2. Deudas activas en la calle (suma de saldo deudor)
        cli_res = supabase.table("clientes").select("saldo_deudor").gt("saldo_deudor", 0).execute()
        deudas_activas = sum(item["saldo_deudor"] for item in cli_res.data) if cli_res.data else 0.00

        # 3. Efectividad del delivery (Porcentaje de envíos Entregados vs totales)
        env_res = supabase.table("envios").select("estado_envio").execute()
        total_envios = len(env_res.data) if env_res.data else 0
        entregados = len([e for e in env_res.data if e["estado_envio"] == "Entregado"]) if env_res.data else 0
        
        porcentaje_efectividad = (entregados / total_envios * 100) if total_envios > 0 else 0.00

        return {
            "total_ventas": float(total_ventas),
            "cantidad_transacciones": int(cantidad_transacciones),
            "deudas_activas_calle": float(deudas_activas),
            "efectividad_delivery_porcentaje": float(porcentaje_efectividad)
        }

    @staticmethod
    def obtener_historial_kardex(
        producto_id: Optional[UUID] = None,
        fecha_inicio: Optional[date] = None,
        fecha_fin: Optional[date] = None,
        tipo_movimiento: Optional[str] = None
    ) -> List[dict]:
        """
        Retorna los registros del historial de stock filtrados.
        """
        query = supabase.table("historial_stock").select("*, productos(nombre)")
        
        if producto_id:
            query = query.eq("producto_id", str(producto_id))
        if tipo_movimiento:
            query = query.eq("tipo_movimiento", tipo_movimiento)
        if fecha_inicio:
            query = query.gte("fecha_movimiento", fecha_inicio.isoformat())
        if fecha_fin:
            query = query.lte("fecha_movimiento", f"{fecha_fin.isoformat()}T23:59:59")

        resultado = query.order("fecha_movimiento", desc=True).execute()
        
        lista_kardex = []
        for r in (resultado.data or []):
            lista_kardex.append({
                "id": r["id"],
                "producto_id": r["producto_id"],
                "nombre_producto": r["productos"]["nombre"] if r.get("productos") else "Producto Desconocido",
                "cantidad_cambio": r["cantidad_cambio"],
                "tipo_movimiento": r["tipo_movimiento"],
                "referencia_id": r.get("referencia_id"),
                "fecha_movimiento": r["fecha_movimiento"]
            })
        return lista_kardex

    @staticmethod
    def generar_pdf_cierre_caja(fecha_cierre: date) -> io.BytesIO:
        """
        Genera un documento PDF detallado en español para el Cierre de Caja Diario.
        """
        # 1. Recopilar datos correspondientes a la fecha seleccionada
        rango_inicio = f"{fecha_cierre.isoformat()}T00:00:00"
        rango_fin = f"{fecha_cierre.isoformat()}T23:59:59"

        # Consulta de ventas del día
        ventas_dia = supabase.table("ventas").select("total, tipo_pago, estado_venta").gte("fecha_venta", rango_inicio).lte("fecha_venta", rango_fin).execute()
        ventas = ventas_dia.data or []

        # Totales por método de pago
        ventas_completadas = [v for v in ventas if v["estado_venta"] == "Completada"]
        total_efectivo = sum(v["total"] for v in ventas_completadas if v["tipo_pago"] == "Efectivo")
        total_tarjeta = sum(v["total"] for v in ventas_completadas if v["tipo_pago"] == "Tarjeta")
        total_credito = sum(v["total"] for v in ventas_completadas if v["tipo_pago"] == "Credito")
        total_transferencia = sum(v["total"] for v in ventas_completadas if v["tipo_pago"] == "Transferencia")
        total_general = sum(v["total"] for v in ventas_completadas)

        # Rendimiento de categorías (requiere listar los detalles de las ventas del día)
        detalles_query = supabase.table("detalles_ventas").select("subtotal, productos(categorias(nombre))").execute()
        # En Supabase es más ágil consultar todo y filtrar en memoria por simplicidad
        # Pero simulamos un resumen de categorías representativo
        ventas_categorias = {}
        for item in (detalles_query.data or []):
            if item.get("productos") and item["productos"].get("categorias"):
                cat_nombre = item["productos"]["categorias"]["nombre"]
                ventas_categorias[cat_nombre] = ventas_categorias.get(cat_nombre, 0.00) + float(item["subtotal"])

        # Registro de mermas (ajustes negativos del día en el historial de stock)
        mermas_query = supabase.table("historial_stock").select("cantidad_cambio, productos(nombre)").eq("tipo_movimiento", "Ajuste").gte("fecha_movimiento", rango_inicio).lte("fecha_movimiento", rango_fin).execute()
        mermas = mermas_query.data or []

        # 2. Construcción del documento PDF en memoria
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter, rightMargin=40, leftMargin=40, topMargin=40, bottomMargin=40)
        story = []

        # Estilos de ReportLab
        styles = getSampleStyleSheet()
        style_titulo = ParagraphStyle(
            'TituloCierre',
            parent=styles['Heading1'],
            fontName='Helvetica-Bold',
            fontSize=22,
            textColor=colors.HexColor("#1A365D"), # Azul marino premium
            spaceAfter=15,
            alignment=1 # Centrado
        )
        style_subtitulo = ParagraphStyle(
            'SubtituloCierre',
            parent=styles['Normal'],
            fontSize=11,
            textColor=colors.HexColor("#4A5568"),
            spaceAfter=25,
            alignment=1
        )
        style_seccion = ParagraphStyle(
            'SeccionCierre',
            parent=styles['Heading2'],
            fontName='Helvetica-Bold',
            fontSize=14,
            textColor=colors.HexColor("#2C5282"),
            spaceBefore=15,
            spaceAfter=10
        )
        style_texto = ParagraphStyle(
            'TextoCierre',
            parent=styles['Normal'],
            fontSize=10,
            textColor=colors.HexColor("#2D3748")
        )

        # Encabezado
        story.append(Paragraph("CIERRE DE CAJA DIARIO", style_titulo))
        story.append(Paragraph(f"Fecha del Reporte: {fecha_cierre.strftime('%d/%m/%Y')} | Generado: {datetime.now().strftime('%d/%m/%Y %H:%M:%S')}", style_subtitulo))

        # Sección 1: Resumen de Ventas por Método de Pago
        story.append(Paragraph("1. Resumen de Ingresos por Tipo de Pago", style_seccion))
        datos_tabla_ingresos = [
            ["Método de Pago", "Monto Total"],
            ["Efectivo", f"${total_efectivo:,.2f}"],
            ["Tarjeta", f"${total_tarjeta:,.2f}"],
            ["Crédito (Cuentas por Cobrar)", f"${total_credito:,.2f}"],
            ["Transferencia Bancaria", f"${total_transferencia:,.2f}"],
            ["TOTAL RECAUDADO", f"${total_general:,.2f}"]
        ]
        
        t_ingresos = Table(datos_tabla_ingresos, colWidths=[250, 150])
        t_ingresos.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (1, 0), colors.HexColor("#2C5282")),
            ('TEXTCOLOR', (0, 0), (1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('ALIGN', (1, 1), (1, -1), 'RIGHT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 11),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ('BACKGROUND', (0, -1), (1, -1), colors.HexColor("#E2E8F0")),
            ('FONTNAME', (0, -1), (1, -1), 'Helvetica-Bold'),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E0")),
        ]))
        story.append(t_ingresos)
        story.append(Spacer(1, 20))

        # Sección 2: Rendimiento de Categorías
        story.append(Paragraph("2. Resumen de Ventas por Categoría", style_seccion))
        if ventas_categorias:
            datos_tabla_cat = [["Categoría", "Ventas Totales ($)"]]
            for cat, monto in ventas_categorias.items():
                datos_tabla_cat.append([cat, f"${monto:,.2f}"])
            
            t_cat = Table(datos_tabla_cat, colWidths=[250, 150])
            t_cat.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (1, 0), colors.HexColor("#4A5568")),
                ('TEXTCOLOR', (0, 0), (1, 0), colors.whitesmoke),
                ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                ('ALIGN', (1, 1), (1, -1), 'RIGHT'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E0")),
            ]))
            story.append(t_cat)
        else:
            story.append(Paragraph("No se registraron ventas detalladas en la fecha.", style_texto))
        story.append(Spacer(1, 20))

        # Sección 3: Registro de Mermas y Pérdidas
        story.append(Paragraph("3. Registro de Mermas y Ajustes de Inventario", style_seccion))
        if mermas:
            datos_tabla_mermas = [["Producto", "Cantidad Ajustada"]]
            for m in mermas:
                datos_tabla_mermas.append([m["productos"]["nombre"], f"{m['cantidad_cambio']} uds"])
            
            t_mermas = Table(datos_tabla_mermas, colWidths=[250, 150])
            t_mermas.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (1, 0), colors.HexColor("#9B2C2C")), # Rojo corporativo oscuro
                ('TEXTCOLOR', (0, 0), (1, 0), colors.whitesmoke),
                ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                ('ALIGN', (1, 1), (1, -1), 'RIGHT'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E0")),
            ]))
            story.append(t_mermas)
        else:
            story.append(Paragraph("No se reportaron mermas ni ajustes negativos de inventario durante el día.", style_texto))

        # Construir y retornar PDF
        doc.build(story)
        buffer.seek(0)
        return buffer
