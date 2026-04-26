# Frontend Setup - React + Vite + Django REST Framework

## Estructura del Proyecto

```
frontend/
├── src/
│   ├── components/     # Componentes reutilizables
│   ├── pages/          # Páginas/vistas de la aplicación
│   ├── services/       # Servicios para comunicación con API
│   │   └── api.js      # Cliente axios configurado
│   ├── hooks/          # Custom React hooks
│   ├── utils/          # Funciones utilitarias
│   ├── App.jsx         # Componente principal con router
│   └── main.jsx        # Punto de entrada
├── vite.config.js      # Configuración de Vite con proxy
└── .env                # Variables de entorno
```

## Configuración Realizada

### Backend (Django)
- ✅ Django REST Framework instalado
- ✅ django-cors-headers instalado y configurado
- ✅ CORS habilitado para http://localhost:5173
- ✅ Autenticación por sesión configurada
- ✅ Paginación configurada (100 items por página)

### Frontend (React + Vite)
- ✅ Proyecto creado con Vite y template React
- ✅ Axios instalado para peticiones HTTP
- ✅ React Router Dom instalado para enrutamiento
- ✅ Proxy configurado en Vite para /api, /admin, /accounts
- ✅ Cliente API configurado con CSRF token de Django
- ✅ Estructura de carpetas creada

## Cómo Usar

### 1. Iniciar el Backend (Django)
```bash
cd backend
python manage.py runserver
```

### 2. Iniciar el Frontend (React)
```bash
cd frontend
npm run dev
```

El frontend estará disponible en: http://localhost:5173
El backend estará disponible en: http://localhost:8000

## Hacer Peticiones a la API

### Ejemplo básico con el servicio api.js:
```javascript
import api from './services/api';

// GET request
const getActividades = async () => {
  try {
    const response = await api.get('/actividades/');
    return response.data;
  } catch (error) {
    console.error('Error:', error);
  }
};

// POST request
const createActividad = async (data) => {
  try {
    const response = await api.post('/actividades/', data);
    return response.data;
  } catch (error) {
    console.error('Error:', error);
  }
};
```

## Próximos Pasos

1. Crear componentes en `src/components/`
2. Crear páginas en `src/pages/`
3. Definir rutas en `src/App.jsx`
4. Crear servicios específicos para cada endpoint de la API
5. Implementar autenticación/login en el frontend
6. Agregar manejo de estado global (Context API, Redux, Zustand, etc.)

## Dependencias Instaladas

- react: ^19.2.0
- react-dom: ^19.2.0
- react-router-dom: ^7.1.4
- axios: ^1.7.9
- vite: ^7.2.4

## Notas Importantes

- El cliente API está configurado con `withCredentials: true` para manejar sesiones de Django
- El CSRF token se maneja automáticamente en los interceptores de axios
- Las peticiones a rutas que empiecen con /api, /admin o /accounts se redirigen al backend automáticamente
- Si el backend responde con 401 (no autenticado), se redirige automáticamente a /accounts/login/
