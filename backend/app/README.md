# Estructura del Backend - TiendaLocal

Este backend está estructurado siguiendo un diseño modular para FastAPI:
- `/app/main.py`: Punto de entrada del servidor.
- `/app/database/`: Contiene la lógica de conexión al cliente de Supabase.
- `/app/routers/`: Enrutadores de endpoints divididos por módulo.
- `/app/schemas/`: Modelos Pydantic para validación y serialización de datos de entrada/salida.
- `/app/services/`: Capa lógica encargada de interactuar con Supabase/BD y orquestar flujos.
