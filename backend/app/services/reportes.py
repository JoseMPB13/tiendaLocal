# =============================================================================
# SERVICIO: reportes.py
# Propósito: Generación de reportes analíticos ejecutivos en formato PDF.
#            Utiliza ReportLab para construir layouts corporativos con tablas y
#            gráficos vectoriales nativos.
# Idioma: Español
# =============================================================================

import io
from typing import List, Optional
from datetime import datetime, date
from zoneinfo import ZoneInfo
from uuid import UUID
from decimal import Decimal
from fastapi import HTTPException, status
from app.database import supabase
from app.schemas.modelos import DashboardMetricas, MovimientoKardex

# Librerías de ReportLab para la exportación de PDF
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.pdfgen import canvas
from reportlab.graphics.shapes import Drawing, Rect, String

# Zona horaria oficial de Bolivia para marcas temporales en reportes PDF
ZONA_HORARIA_BOLIVIA = ZoneInfo("America/La_Paz")


class NumberedCanvas(canvas.Canvas):
    """
    Canvas personalizado para calcular y dibujar la paginación dinámica 'Página X de Y'
    y el encabezado/pie de página institucional en cada página del reporte.
    """
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_page_decorations(self, page_count):
        self.saveState()
        self.setFont("Helvetica-Bold", 8)
        self.setFillColor(colors.HexColor("#1E3A8A")) # Azul marino corporativo

        # Cabecera Institucional
        self.drawString(40, 750, "TIENDA MARGARITA")
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#475569"))
        self.drawRightString(572, 750, "SISTEMA DE GESTIÓN Y AUDITORÍA")
        
        # Línea divisoria de cabecera
        self.setStrokeColor(colors.HexColor("#CBD5E1"))
        self.setLineWidth(0.5)
        self.line(40, 742, 572, 742)
        
        # Pie de página
        self.line(40, 50, 572, 50)
        self.drawString(40, 35, "Reporte de Auditoría Interna — Tienda Margarita")
        page_text = f"Página {self._pageNumber} de {page_count}"
        self.drawRightString(572, 35, page_text)
        
        self.restoreState()


class ReporteService:
    @staticmethod
    def obtener_metricas_dashboard(fecha_inicio: Optional[date] = None, fecha_fin: Optional[date] = None) -> dict:
        """
        Calcula y agrupa métricas clave del negocio consumiendo una función RPC en Supabase.
        """
        param_inicio = fecha_inicio.isoformat() if fecha_inicio else None
        param_fin = fecha_fin.isoformat() if fecha_fin else None
        resultado = supabase.rpc("obtener_metricas_dashboard", {
            "p_fecha_inicio": param_inicio,
            "p_fecha_fin": param_fin
        }).execute()
        if not resultado.data:
            return {
                "total_ventas": 0.00,
                "cantidad_transacciones": 0,
                "deudas_activas_calle": 0.00,
                "efectividad_delivery_porcentaje": 0.00,
                "clientes_activos": 0,
                "ventas_por_categoria": [],
                "tendencia_ventas": 0.00
            }
        return resultado.data

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
                "motivo": r.get("motivo"),
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
        ventas_dia = supabase.table("ventas").select("id, total, tipo_pago, estado_venta").gte("fecha_venta", rango_inicio).lte("fecha_venta", rango_fin).execute()
        ventas = ventas_dia.data or []

        # Totales por método de pago usando precisión Decimal
        ventas_completadas = [v for v in ventas if v["estado_venta"] == "Completada"]
        total_efectivo = sum(Decimal(str(v["total"])) for v in ventas_completadas if v["tipo_pago"] == "Efectivo") if ventas_completadas else Decimal("0.00")
        total_tarjeta = sum(Decimal(str(v["total"])) for v in ventas_completadas if v["tipo_pago"] == "Tarjeta") if ventas_completadas else Decimal("0.00")
        total_qr = sum(Decimal(str(v["total"])) for v in ventas_completadas if v["tipo_pago"] == "QR") if ventas_completadas else Decimal("0.00")
        total_credito = sum(Decimal(str(v["total"])) for v in ventas_completadas if v["tipo_pago"] == "Credito") if ventas_completadas else Decimal("0.00")
        total_transferencia = sum(Decimal(str(v["total"])) for v in ventas_completadas if v["tipo_pago"] == "Transferencia") if ventas_completadas else Decimal("0.00")
        total_general = sum(Decimal(str(v["total"])) for v in ventas_completadas) if ventas_completadas else Decimal("0.00")

        # Rendimiento de categorías (requiere listar los detalles de las ventas del día)
        ventas_categorias = {}
        venta_ids = [v["id"] for v in ventas_completadas]
        if venta_ids:
            detalles_query = supabase.table("detalles_ventas").select("subtotal, productos(categorias(nombre))").in_("venta_id", venta_ids).execute()
            for item in (detalles_query.data or []):
                if item.get("productos") and item["productos"].get("categorias"):
                    cat_nombre = item["productos"]["categorias"]["nombre"]
                    ventas_categorias[cat_nombre] = ventas_categorias.get(cat_nombre, Decimal("0.00")) + Decimal(str(item["subtotal"]))

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
        story.append(Paragraph(f"Fecha del Reporte: {fecha_cierre.strftime('%d/%m/%Y')} | Generado: {datetime.now(ZONA_HORARIA_BOLIVIA).strftime('%d/%m/%Y %H:%M:%S')}", style_subtitulo))

        # Sección 1: Resumen de Ventas por Método de Pago
        story.append(Paragraph("1. Resumen de Ingresos por Tipo de Pago", style_seccion))
        datos_tabla_ingresos = [
            ["Método de Pago", "Monto Total"],
            ["Efectivo", f"Bs. {total_efectivo:,.2f}"],
            ["Tarjeta", f"Bs. {total_tarjeta:,.2f}"],
            ["Pago QR", f"Bs. {total_qr:,.2f}"],
            ["Crédito (Cuentas por Cobrar)", f"Bs. {total_credito:,.2f}"],
            ["Transferencia Bancaria", f"Bs. {total_transferencia:,.2f}"],
            ["TOTAL RECAUDADO", f"Bs. {total_general:,.2f}"]
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
            datos_tabla_cat = [["Categoría", "Ventas Totales (Bs.)"]]
            for cat, monto in ventas_categorias.items():
                datos_tabla_cat.append([cat, f"Bs. {monto:,.2f}"])
            
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

    # ──────────────────────────────────────────────────────────────────────────
    # AUXILIAR: DISEÑO DE GRÁFICOS VECTORIALES NATIVOS
    # ──────────────────────────────────────────────────────────────────────────
    @staticmethod
    def _dibujar_grafico_barras(datos: List[dict], width=480, height=180) -> Drawing:
        """
        Dibuja un gráfico de barras vectorial nativo usando formas geométricas de ReportLab.
        Esto asegura portabilidad y evita dependencias externas.
        datos: lista de diccionarios con llaves 'name' y 'valor'
        """
        drawing = Drawing(width, height)
        
        # Fondo del gráfico
        drawing.add(Rect(0, 0, width, height, strokeColor=colors.HexColor("#E2E8F0"), fillColor=colors.HexColor("#F8FAFC"), strokeWidth=0.5))
        
        if not datos:
            drawing.add(String(width/2, height/2, "Sin datos suficientes para graficar", textAnchor='middle', fontSize=10, fillColor=colors.HexColor("#94A3B8")))
            return drawing
            
        max_val = max(float(x['valor']) for x in datos) if datos else 1.0
        if max_val == 0:
            max_val = 1.0
            
        num_items = len(datos)
        chart_left = 40
        chart_right = width - 20
        chart_bottom = 30
        chart_top = height - 20
        
        plot_width = chart_right - chart_left
        plot_height = chart_top - chart_bottom
        
        bar_width = min(35, plot_width / num_items * 0.6)
        gap = (plot_width - (bar_width * num_items)) / (num_items + 1)
        
        # Eje horizontal y vertical
        drawing.add(Rect(chart_left, chart_bottom, plot_width, 1, strokeColor=colors.HexColor("#CBD5E1"), fillColor=colors.HexColor("#CBD5E1")))
        
        colores_paleta = [
            colors.HexColor("#4F46E5"), # Indigo
            colors.HexColor("#10B981"), # Emerald
            colors.HexColor("#F59E0B"), # Amber
            colors.HexColor("#EF4444"), # Rose
            colors.HexColor("#3B82F6"), # Blue
            colors.HexColor("#EC4899"), # Pink
            colors.HexColor("#8B5CF6"), # Purple
            colors.HexColor("#06B6D4")  # Cyan
        ]
        
        for i, item in enumerate(datos):
            val = float(item['valor'])
            bar_height = (val / max_val) * (plot_height - 20)
            if val > 0 and bar_height < 3:
                bar_height = 3
                
            x = chart_left + gap + i * (bar_width + gap)
            y = chart_bottom
            
            color = colores_paleta[i % len(colores_paleta)]
            drawing.add(Rect(x, y, bar_width, bar_height, strokeColor=None, fillColor=color))
            
            # Etiqueta de valor
            label_val = f"{val:,.1f}" if val % 1 != 0 else f"{int(val)}"
            drawing.add(String(x + bar_width/2, y + bar_height + 5, label_val, textAnchor='middle', fontSize=7, fillColor=colors.HexColor("#1E293B")))
            
            # Etiqueta de nombre abajo del eje (truncado a 12 caracteres)
            label_name = item['name']
            if len(label_name) > 12:
                label_name = label_name[:10] + ".."
            drawing.add(String(x + bar_width/2, y - 12, label_name, textAnchor='middle', fontSize=7, fillColor=colors.HexColor("#64748B")))
            
        return drawing

    # ──────────────────────────────────────────────────────────────────────────
    # REPORTES PDF NUEVOS POR SECCIÓN
    # ──────────────────────────────────────────────────────────────────────────

    @staticmethod
    def generar_pdf_ventas(fecha_inicio: Optional[date] = None, fecha_fin: Optional[date] = None) -> io.BytesIO:
        """
        Genera el reporte PDF consolidado de ventas de la tienda.
        """
        query = supabase.table("ventas").select("*, clientes(nombre)").order("fecha_venta", desc=True)
        if fecha_inicio:
            query = query.gte("fecha_venta", f"{fecha_inicio.isoformat()}T00:00:00")
        if fecha_fin:
            query = query.lte("fecha_venta", f"{fecha_fin.isoformat()}T23:59:59")
            
        res = query.execute()
        ventas = res.data or []
        
        # Calcular estadísticas
        total_monto = Decimal("0.00")
        completadas = 0
        por_pago = {}
        for v in ventas:
            if v["estado_venta"] == "Completada":
                monto = Decimal(str(v["total"]))
                total_monto += monto
                completadas += 1
                tp = v.get("tipo_pago") or "Otro"
                por_pago[tp] = por_pago.get(tp, Decimal("0.00")) + monto
                
        datos_grafico = [{"name": k, "valor": float(v)} for k, v in por_pago.items()]
        
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter, rightMargin=40, leftMargin=40, topMargin=80, bottomMargin=70)
        story = []
        
        styles = getSampleStyleSheet()
        style_titulo = ParagraphStyle('T1', parent=styles['Heading1'], fontName='Helvetica-Bold', fontSize=18, textColor=colors.HexColor("#1E3A8A"), spaceAfter=5)
        style_sub = ParagraphStyle('S1', parent=styles['Normal'], fontSize=9, textColor=colors.HexColor("#475569"), spaceAfter=15)
        style_seccion = ParagraphStyle('Sec1', parent=styles['Heading2'], fontName='Helvetica-Bold', fontSize=12, textColor=colors.HexColor("#1E3A8A"), spaceBefore=10, spaceAfter=8)
        style_cell = ParagraphStyle('C1', parent=styles['Normal'], fontSize=8, leading=10, textColor=colors.HexColor("#1E293B"))
        style_cell_bold = ParagraphStyle('C1B', parent=style_cell, fontName='Helvetica-Bold')
        style_cell_white = ParagraphStyle('C1W', parent=style_cell_bold, textColor=colors.white)
        
        story.append(Paragraph("REPORTE EJECUTIVO DE VENTAS", style_titulo))
        filtro_txt = f"Periodo: {fecha_inicio.strftime('%d/%m/%Y')} al {fecha_fin.strftime('%d/%m/%Y')}" if (fecha_inicio and fecha_fin) else "Historial Completo"
        story.append(Paragraph(f"{filtro_txt} | Total Ventas: {completadas} transacciones completadas", style_sub))
        
        kpi_data = [
            [
                Paragraph("<b>Total Recaudado (Bs.)</b>", style_cell),
                Paragraph("<b>Transacciones</b>", style_cell),
                Paragraph("<b>Promedio por Ticket</b>", style_cell)
            ],
            [
                Paragraph(f"Bs. {total_monto:,.2f}", style_titulo),
                Paragraph(str(completadas), style_titulo),
                Paragraph(f"Bs. {(total_monto / max(1, completadas)):,.2f}", style_titulo)
            ]
        ]
        t_kpi = Table(kpi_data, colWidths=[180, 150, 202])
        t_kpi.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#F8FAFC")),
            ('BOX', (0, 0), (-1, -1), 1, colors.HexColor("#E2E8F0")),
            ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
            ('PADDING', (0, 0), (-1, -1), 10),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ]))
        story.append(t_kpi)
        story.append(Spacer(1, 15))
        
        story.append(Paragraph("Distribución de Ingresos por Método de Pago", style_seccion))
        story.append(ReporteService._dibujar_grafico_barras(datos_grafico))
        story.append(Spacer(1, 15))
        
        story.append(Paragraph("Detalle de Transacciones (Muestra de 50 registros)", style_seccion))
        t_headers = [
            Paragraph("Código Venta", style_cell_white),
            Paragraph("Fecha", style_cell_white),
            Paragraph("Cliente", style_cell_white),
            Paragraph("Método Pago", style_cell_white),
            Paragraph("Monto", style_cell_white),
            Paragraph("Estado", style_cell_white)
        ]
        t_rows = [t_headers]
        for v in ventas[:50]:
            cli = v.get("clientes")
            cli_nom = cli.get("nombre", "Cliente General") if cli else "Cliente General"
            t_rows.append([
                Paragraph(str(v["id"])[:8].upper(), style_cell),
                Paragraph(datetime.fromisoformat(v["fecha_venta"].replace("Z", "+00:00")).strftime("%d/%m/%Y %H:%M"), style_cell),
                Paragraph(cli_nom, style_cell),
                Paragraph(v.get("tipo_pago") or "Otro", style_cell),
                Paragraph(f"Bs. {Decimal(str(v['total'])):,.2f}", style_cell_bold),
                Paragraph(v.get("estado_venta"), style_cell)
            ])
            
        t_detalles = Table(t_rows, colWidths=[70, 95, 127, 85, 75, 80])
        t_detalles.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#1E3A8A")),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor("#F8FAFC")]),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
            ('PADDING', (0, 0), (-1, -1), 5),
        ]))
        story.append(t_detalles)
        
        doc.build(story, canvasmaker=NumberedCanvas)
        buffer.seek(0)
        return buffer

    @staticmethod
    def generar_pdf_productos() -> io.BytesIO:
        """
        Genera el reporte PDF consolidado de productos y stock crítico.
        """
        res = supabase.table("productos").select("*, categorias(nombre)").eq("estado", "Activo").order("nombre").execute()
        productos = res.data or []
        
        total_inventario_val = Decimal("0.00")
        total_articulos = len(productos)
        criticos = 0
        por_categoria_stock = {}
        
        for p in productos:
            stock = int(p["stock_actual"])
            minimo = int(p["stock_minimo"])
            precio = Decimal(str(p["precio_venta"]))
            total_inventario_val += (stock * precio)
            
            if stock <= minimo:
                criticos += 1
                
            cat = p.get("categorias")
            cat_nom = cat.get("nombre", "Sin Categoría") if cat else "Sin Categoría"
            por_categoria_stock[cat_nom] = por_categoria_stock.get(cat_nom, 0) + stock
            
        datos_grafico = [{"name": k, "valor": float(v)} for k, v in por_categoria_stock.items()]
        
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter, rightMargin=40, leftMargin=40, topMargin=80, bottomMargin=70)
        story = []
        
        styles = getSampleStyleSheet()
        style_titulo = ParagraphStyle('T2', parent=styles['Heading1'], fontName='Helvetica-Bold', fontSize=18, textColor=colors.HexColor("#1E3A8A"), spaceAfter=5)
        style_sub = ParagraphStyle('S2', parent=styles['Normal'], fontSize=9, textColor=colors.HexColor("#475569"), spaceAfter=15)
        style_seccion = ParagraphStyle('Sec2', parent=styles['Heading2'], fontName='Helvetica-Bold', fontSize=12, textColor=colors.HexColor("#1E3A8A"), spaceBefore=10, spaceAfter=8)
        style_cell = ParagraphStyle('C2', parent=styles['Normal'], fontSize=8, leading=10, textColor=colors.HexColor("#1E293B"))
        style_cell_bold = ParagraphStyle('C2B', parent=style_cell, fontName='Helvetica-Bold')
        style_cell_white = ParagraphStyle('C2W', parent=style_cell_bold, textColor=colors.white)
        style_critico = ParagraphStyle('Crit', parent=style_cell_bold, textColor=colors.HexColor("#EF4444"))
        
        story.append(Paragraph("REPORTE DE INVENTARIO Y ALERTA DE STOCK CRÍTICO", style_titulo))
        story.append(Paragraph(f"Total productos en catálogo: {total_articulos} | Alertas de stock crítico: {criticos} productos", style_sub))
        
        kpi_data = [
            [
                Paragraph("<b>Total Productos</b>", style_cell),
                Paragraph("<b>Productos Críticos</b>", style_cell),
                Paragraph("<b>Valoración del Stock (Bs.)</b>", style_cell)
            ],
            [
                Paragraph(str(total_articulos), style_titulo),
                Paragraph(str(criticos), style_critico if criticos > 0 else style_titulo),
                Paragraph(f"Bs. {total_inventario_val:,.2f}", style_titulo)
            ]
        ]
        t_kpi = Table(kpi_data, colWidths=[150, 150, 232])
        t_kpi.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#F8FAFC")),
            ('BOX', (0, 0), (-1, -1), 1, colors.HexColor("#E2E8F0")),
            ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
            ('PADDING', (0, 0), (-1, -1), 10),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ]))
        story.append(t_kpi)
        story.append(Spacer(1, 15))
        
        story.append(Paragraph("Distribución de Unidades de Stock por Categoría", style_seccion))
        story.append(ReporteService._dibujar_grafico_barras(datos_grafico))
        story.append(Spacer(1, 15))
        
        story.append(Paragraph("Detalle de Productos e Inventario", style_seccion))
        t_headers = [
            Paragraph("Nombre Producto", style_cell_white),
            Paragraph("Categoría", style_cell_white),
            Paragraph("Precio Venta", style_cell_white),
            Paragraph("Stock Actual", style_cell_white),
            Paragraph("Stock Mínimo", style_cell_white),
            Paragraph("Estado", style_cell_white)
        ]
        t_rows = [t_headers]
        for p in productos:
            stock = int(p["stock_actual"])
            minimo = int(p["stock_minimo"])
            es_critico = stock <= minimo
            estado_txt = "STOCK CRÍTICO" if es_critico else "OK"
            style_estado = style_critico if es_critico else style_cell_bold
            
            cat = p.get("categorias")
            cat_nom = cat.get("nombre", "Sin Categoría") if cat else "Sin Categoría"
            
            t_rows.append([
                Paragraph(p["nombre"], style_cell),
                Paragraph(cat_nom, style_cell),
                Paragraph(f"Bs. {Decimal(str(p['precio_venta'])):,.2f}", style_cell),
                Paragraph(f"{stock} uds", style_critico if es_critico else style_cell),
                Paragraph(f"{minimo} uds", style_cell),
                Paragraph(estado_txt, style_estado)
            ])
            
        t_detalles = Table(t_rows, colWidths=[140, 110, 75, 65, 65, 77])
        t_detalles.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#1E3A8A")),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor("#F8FAFC")]),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
            ('PADDING', (0, 0), (-1, -1), 5),
        ]))
        story.append(t_detalles)
        
        doc.build(story, canvasmaker=NumberedCanvas)
        buffer.seek(0)
        return buffer

    @staticmethod
    def generar_pdf_categorias() -> io.BytesIO:
        """
        Genera el reporte PDF consolidado de categorías y volumen de artículos.
        """
        res_cats = supabase.table("categorias").select("*").eq("estado", "Activo").order("nombre").execute()
        res_prods = supabase.table("productos").select("categoria_id, stock_actual, precio_venta").eq("estado", "Activo").execute()
        
        categorias = res_cats.data or []
        productos = res_prods.data or []
        
        articulos_por_cat = {}
        valor_por_cat = {}
        
        for p in productos:
            cat_id = p.get("categoria_id")
            if cat_id:
                articulos_por_cat[cat_id] = articulos_por_cat.get(cat_id, 0) + 1
                stock = int(p["stock_actual"])
                precio = Decimal(str(p["precio_venta"]))
                valor_por_cat[cat_id] = valor_por_cat.get(cat_id, Decimal("0.00")) + (stock * precio)
                
        datos_grafico = []
        
        styles = getSampleStyleSheet()
        style_cell = ParagraphStyle('C3', parent=styles['Normal'], fontSize=8, leading=10, textColor=colors.HexColor("#1E293B"))
        style_cell_bold = ParagraphStyle('C3B', parent=style_cell, fontName='Helvetica-Bold')
        style_cell_white = ParagraphStyle('C3W', parent=style_cell_bold, textColor=colors.white)
        style_titulo = ParagraphStyle('T3', parent=styles['Heading1'], fontName='Helvetica-Bold', fontSize=18, textColor=colors.HexColor("#1E3A8A"), spaceAfter=5)
        style_sub = ParagraphStyle('S3', parent=styles['Normal'], fontSize=9, textColor=colors.HexColor("#475569"), spaceAfter=15)
        style_seccion = ParagraphStyle('Sec3', parent=styles['Heading2'], fontName='Helvetica-Bold', fontSize=12, textColor=colors.HexColor("#1E3A8A"), spaceBefore=10, spaceAfter=8)
        
        t_rows = [[
            Paragraph("Categoría", style_cell_white),
            Paragraph("Descripción", style_cell_white),
            Paragraph("Productos Activos", style_cell_white),
            Paragraph("Valor del Inventario", style_cell_white)
        ]]
        
        total_categorias = len(categorias)
        total_valor_inventario = Decimal("0.00")
        
        for c in categorias:
            cat_id = c["id"]
            cant_prods = articulos_por_cat.get(cat_id, 0)
            valor_inventario = valor_por_cat.get(cat_id, Decimal("0.00"))
            total_valor_inventario += valor_inventario
            
            datos_grafico.append({"name": c["nombre"], "valor": float(valor_inventario)})
            
            t_rows.append([
                Paragraph(c["nombre"], style_cell_bold),
                Paragraph(c.get("descripcion") or "Sin descripción", style_cell),
                Paragraph(f"{cant_prods} productos", style_cell),
                Paragraph(f"Bs. {valor_inventario:,.2f}", style_cell_bold)
            ])
            
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter, rightMargin=40, leftMargin=40, topMargin=80, bottomMargin=70)
        story = []
        
        story.append(Paragraph("REPORTE CONSOLIDADO DE CATEGORÍAS", style_titulo))
        story.append(Paragraph(f"Total categorías activas: {total_categorias} | Valorización total de inventario: Bs. {total_valor_inventario:,.2f}", style_sub))
        
        kpi_data = [
            [
                Paragraph("<b>Total Categorías</b>", style_cell),
                Paragraph("<b>Valorización de Inventario</b>", style_cell)
            ],
            [
                Paragraph(str(total_categorias), style_titulo),
                Paragraph(f"Bs. {total_valor_inventario:,.2f}", style_titulo)
            ]
        ]
        t_kpi = Table(kpi_data, colWidths=[200, 332])
        t_kpi.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#F8FAFC")),
            ('BOX', (0, 0), (-1, -1), 1, colors.HexColor("#E2E8F0")),
            ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
            ('PADDING', (0, 0), (-1, -1), 10),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ]))
        story.append(t_kpi)
        story.append(Spacer(1, 15))
        
        story.append(Paragraph("Valor del Inventario por Categoría (Bs.)", style_seccion))
        story.append(ReporteService._dibujar_grafico_barras(datos_grafico))
        story.append(Spacer(1, 15))
        
        story.append(Paragraph("Listado Detallado de Categorías", style_seccion))
        t_detalles = Table(t_rows, colWidths=[120, 222, 100, 90])
        t_detalles.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#1E3A8A")),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor("#F8FAFC")]),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
            ('PADDING', (0, 0), (-1, -1), 6),
        ]))
        story.append(t_detalles)
        
        doc.build(story, canvasmaker=NumberedCanvas)
        buffer.seek(0)
        return buffer

    @staticmethod
    def generar_pdf_clientes() -> io.BytesIO:
        """
        Genera el reporte PDF consolidado de clientes, deudas y límites de crédito.
        """
        res = supabase.table("clientes").select("*").eq("estado", "Activo").order("saldo_deudor", desc=True).execute()
        clientes = res.data or []
        
        total_clientes = len(clientes)
        deudores = 0
        total_deuda = Decimal("0.00")
        datos_grafico = []
        
        styles = getSampleStyleSheet()
        style_cell = ParagraphStyle('C4', parent=styles['Normal'], fontSize=8, leading=10, textColor=colors.HexColor("#1E293B"))
        style_cell_bold = ParagraphStyle('C4B', parent=style_cell, fontName='Helvetica-Bold')
        style_cell_white = ParagraphStyle('C4W', parent=style_cell_bold, textColor=colors.white)
        style_alerta = ParagraphStyle('Alerta4', parent=style_cell_bold, textColor=colors.HexColor("#EF4444"))
        style_titulo = ParagraphStyle('T4', parent=styles['Heading1'], fontName='Helvetica-Bold', fontSize=18, textColor=colors.HexColor("#1E3A8A"), spaceAfter=5)
        style_sub = ParagraphStyle('S4', parent=styles['Normal'], fontSize=9, textColor=colors.HexColor("#475569"), spaceAfter=15)
        style_seccion = ParagraphStyle('Sec4', parent=styles['Heading2'], fontName='Helvetica-Bold', fontSize=12, textColor=colors.HexColor("#1E3A8A"), spaceBefore=10, spaceAfter=8)
        
        t_rows = [[
            Paragraph("Nombre Cliente", style_cell_white),
            Paragraph("Teléfono", style_cell_white),
            Paragraph("Dirección", style_cell_white),
            Paragraph("Límite Crédito", style_cell_white),
            Paragraph("Saldo Deudor", style_cell_white),
            Paragraph("Estado Crédito", style_cell_white)
        ]]
        
        for c in clientes:
            deuda = Decimal(str(c["saldo_deudor"]))
            limite = Decimal(str(c["limite_credito"]))
            
            if deuda > 0:
                deudores += 1
                total_deuda += deuda
                if len(datos_grafico) < 8:
                    datos_grafico.append({"name": c["nombre"], "valor": float(deuda)})
            
            excede_limite = deuda > limite
            estado_txt = "EXCEDE LÍMITE" if excede_limite else "DEUDOR ACTIVO" if deuda > 0 else "SIN DEUDA"
            style_estado = style_alerta if excede_limite else style_cell_bold if deuda > 0 else style_cell
            
            t_rows.append([
                Paragraph(c["nombre"], style_cell_bold),
                Paragraph(c.get("telefono") or "Sin teléfono", style_cell),
                Paragraph(c.get("direccion") or "Sin dirección", style_cell),
                Paragraph(f"Bs. {limite:,.2f}", style_cell),
                Paragraph(f"Bs. {deuda:,.2f}", style_alerta if deuda > 0 else style_cell),
                Paragraph(estado_txt, style_estado)
            ])
            
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter, rightMargin=40, leftMargin=40, topMargin=80, bottomMargin=70)
        story = []
        
        story.append(Paragraph("REPORTE EJECUTIVO DE CLIENTES Y CRÉDITOS", style_titulo))
        story.append(Paragraph(f"Total clientes registrados: {total_clientes} | Deudores activos: {deudores} | Deuda total acumulada: Bs. {total_deuda:,.2f}", style_sub))
        
        kpi_data = [
            [
                Paragraph("<b>Total Clientes</b>", style_cell),
                Paragraph("<b>Clientes con Deuda</b>", style_cell),
                Paragraph("<b>Deuda Total (Bs.)</b>", style_cell)
            ],
            [
                Paragraph(str(total_clientes), style_titulo),
                Paragraph(str(deudores), style_alerta if deudores > 0 else style_titulo),
                Paragraph(f"Bs. {total_deuda:,.2f}", style_titulo)
            ]
        ]
        t_kpi = Table(kpi_data, colWidths=[150, 150, 232])
        t_kpi.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#F8FAFC")),
            ('BOX', (0, 0), (-1, -1), 1, colors.HexColor("#E2E8F0")),
            ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
            ('PADDING', (0, 0), (-1, -1), 10),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ]))
        story.append(t_kpi)
        story.append(Spacer(1, 15))
        
        story.append(Paragraph("Clientes con Mayores Saldos Deudores (Bs.)", style_seccion))
        story.append(ReporteService._dibujar_grafico_barras(datos_grafico))
        story.append(Spacer(1, 15))
        
        story.append(Paragraph("Listado de Saldos Deudores y Cuentas", style_seccion))
        t_detalles = Table(t_rows, colWidths=[110, 75, 137, 75, 65, 70])
        t_detalles.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#1E3A8A")),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor("#F8FAFC")]),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
            ('PADDING', (0, 0), (-1, -1), 5),
        ]))
        story.append(t_detalles)
        
        doc.build(story, canvasmaker=NumberedCanvas)
        buffer.seek(0)
        return buffer

    @staticmethod
    def generar_pdf_envios(fecha_inicio: Optional[date] = None, fecha_fin: Optional[date] = None) -> io.BytesIO:
        """
        Genera el reporte PDF consolidado de efectividad logística de envíos y repartos.
        """
        query = supabase.table("envios")\
            .select("*, ventas(id, cliente_id, clientes(nombre)), repartidores(usuario_id, usuarios(nombre_completo))")\
            .order("fecha_creacion", desc=True)
            
        if fecha_inicio:
            query = query.gte("fecha_creacion", f"{fecha_inicio.isoformat()}T00:00:00")
        if fecha_fin:
            query = query.lte("fecha_creacion", f"{fecha_fin.isoformat()}T23:59:59")
            
        res = query.execute()
        envios = res.data or []
        
        total_envios = len(envios)
        entregados = 0
        cancelados = 0
        recaudacion_delivery = Decimal("0.00")
        por_estado = {}
        
        for e in envios:
            status_envio = e["estado_envio"]
            por_estado[status_envio] = por_estado.get(status_envio, 0) + 1
            if status_envio == "Entregado":
                entregados += 1
                recaudacion_delivery += Decimal(str(e["costo_envio"]))
            elif status_envio == "Cancelado":
                cancelados += 1
                
        efectividad = (entregados / max(1, total_envios - cancelados)) * 100
        datos_grafico = [{"name": k, "valor": float(v)} for k, v in por_estado.items()]
        
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter, rightMargin=40, leftMargin=40, topMargin=80, bottomMargin=70)
        story = []
        
        styles = getSampleStyleSheet()
        style_cell = ParagraphStyle('C5', parent=styles['Normal'], fontSize=8, leading=10, textColor=colors.HexColor("#1E293B"))
        style_cell_bold = ParagraphStyle('C5B', parent=style_cell, fontName='Helvetica-Bold')
        style_cell_white = ParagraphStyle('C5W', parent=style_cell_bold, textColor=colors.white)
        style_alerta = ParagraphStyle('Alerta5', parent=style_cell_bold, textColor=colors.HexColor("#EF4444"))
        style_titulo = ParagraphStyle('T5', parent=styles['Heading1'], fontName='Helvetica-Bold', fontSize=18, textColor=colors.HexColor("#1E3A8A"), spaceAfter=5)
        style_sub = ParagraphStyle('S5', parent=styles['Normal'], fontSize=9, textColor=colors.HexColor("#475569"), spaceAfter=15)
        style_seccion = ParagraphStyle('Sec5', parent=styles['Heading2'], fontName='Helvetica-Bold', fontSize=12, textColor=colors.HexColor("#1E3A8A"), spaceBefore=10, spaceAfter=8)
        
        story.append(Paragraph("REPORTE DE LOGÍSTICA Y CONTROL DE ENVÍOS (DELIVERY)", style_titulo))
        story.append(Paragraph(f"Total despachos solicitados: {total_envios} | Efectividad de entrega: {efectividad:,.1f}%", style_sub))
        
        kpi_data = [
            [
                Paragraph("<b>Total Envíos</b>", style_cell),
                Paragraph("<b>Efectividad Logística</b>", style_cell),
                Paragraph("<b>Recaudación Delivery (Bs.)</b>", style_cell)
            ],
            [
                Paragraph(str(total_envios), style_titulo),
                Paragraph(f"{efectividad:,.1f}%", style_titulo),
                Paragraph(f"Bs. {recaudacion_delivery:,.2f}", style_titulo)
            ]
        ]
        t_kpi = Table(kpi_data, colWidths=[150, 150, 232])
        t_kpi.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#F8FAFC")),
            ('BOX', (0, 0), (-1, -1), 1, colors.HexColor("#E2E8F0")),
            ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
            ('PADDING', (0, 0), (-1, -1), 10),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ]))
        story.append(t_kpi)
        story.append(Spacer(1, 15))
        
        story.append(Paragraph("Distribución de Envíos por Estado", style_seccion))
        story.append(ReporteService._dibujar_grafico_barras(datos_grafico))
        story.append(Spacer(1, 15))
        
        story.append(Paragraph("Detalle de la Hoja de Ruta de Despacho (Muestra de 50 registros)", style_seccion))
        t_headers = [
            Paragraph("Código Venta", style_cell_white),
            Paragraph("Cliente", style_cell_white),
            Paragraph("Repartidor Asignado", style_cell_white),
            Paragraph("Dirección Despacho", style_cell_white),
            Paragraph("Recargo", style_cell_white),
            Paragraph("Estado Envío", style_cell_white)
        ]
        t_rows = [t_headers]
        for e in envios[:50]:
            venta = e.get("ventas") or {}
            cliente_nom = "Cliente General"
            if venta and venta.get("clientes"):
                cliente_nom = venta["clientes"]["nombre"]
                
            repartidor = e.get("repartidores")
            repa_nom = "Sin Asignar"
            if repartidor and repartidor.get("usuarios"):
                repa_nom = repartidor["usuarios"]["nombre_completo"]
                
            status_envio = e["estado_envio"]
            style_status = style_alerta if status_envio == "Cancelado" else style_cell_bold if status_envio == "Entregado" else style_cell
            
            t_rows.append([
                Paragraph(str(e["venta_id"])[:8].upper(), style_cell),
                Paragraph(cliente_nom, style_cell),
                Paragraph(repa_nom, style_cell),
                Paragraph(e["direccion_despacho"], style_cell),
                Paragraph(f"Bs. {Decimal(str(e['costo_envio'])):,.2f}", style_cell),
                Paragraph(status_envio, style_status)
            ])
            
        t_detalles = Table(t_rows, colWidths=[65, 85, 100, 152, 60, 70])
        t_detalles.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#1E3A8A")),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor("#F8FAFC")]),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
            ('PADDING', (0, 0), (-1, -1), 5),
        ]))
        story.append(t_detalles)
        
        doc.build(story, canvasmaker=NumberedCanvas)
        buffer.seek(0)
        return buffer
