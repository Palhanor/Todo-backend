# Plannet Backend

This is the backend API for the Plannet application, built with Node.js, Express, and Postgres. The project is fully containerized to to minimize differences between development and production environments.

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running.

## Getting Started (Development)

In development mode, we use Docker Compose to run both the API and the Postgres database. The API uses `nodemon` to automatically restart when code changes are detected.

### 1. Setup Environment Variables

Copy the example environment file to create your `.env` file:

```bash
cp .env.example .env
```

Open the `.env` file and fill in the values. For the database to work within the Docker network, use the following default configuration:

```env
DB_HOST=db
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=rootpassword
DB_NAME=doitask
JWT_SECRET=your_jwt_secret
PORT=3001
```

### 2. Run the Project

Start the services using Docker Compose:

```bash
docker compose up -d --build
```

This will:
- Build the API image using the `development` stage.
- Start a Postgres container (service `db`).
- Run the API on `http://localhost:3001`.
- Sync your local code with the container via volumes.

### 3. Check Logs

To follow the logs and ensure everything is running correctly:

```bash
docker logs -f plannet-api-1
```

---

## Production Build

To prepare the project for production, we use a multi-stage Docker build that generates a lightweight image without development dependencies and runs the application using `node` instead of `nodemon`.

### 1. Generate Production Image

Run the following command to build the production-ready image:

```bash
docker build --target production -t plannet-api:prod .
```

### 2. Deployment

The resulting image `plannet-api:prod` is ready to be deployed to any Docker-compatible host (AWS, DigitalOcean, Render, etc.).

**Important:** In production, do **not** bake your `.env` file into the image (it is ignored by `.dockerignore`). You must provide the environment variables via the host's standard mechanisms (e.g., `-e` flags in `docker run` or the platform's environment settings).

```bash
docker run -d \
  -p 3001:3001 \
  -e DB_HOST=your_prod_db_host \
  -e DB_USER=your_prod_user \
  -e DB_PASSWORD=your_prod_password \
  -e DB_NAME=doitask \
  -e JWT_SECRET=your_prod_secret \
  plannet-api:prod
```

## API Endpoints

- **Auth**: `/auth/register`, `/auth/login`
- **User**: `/user` (GET, PUT, DELETE)
- **Tasks**: `/tasks` (GET, POST, PUT, DELETE)
- **Categories**: `/category` (GET, POST, PUT, DELETE)