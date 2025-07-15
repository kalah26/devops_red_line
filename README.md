# DevOps Red Line

![Python](https://img.shields.io/badge/Python-3.9-blue.svg)
![Django](https://img.shields.io/badge/Django-3.2-green.svg)
![React](https://img.shields.io/badge/React-17.0.2-blue.svg)
![Vite](https://img.shields.io/badge/Vite-2.6.4-fb4d3d.svg)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-13.3-orange.svg)
![Terraform](https://img.shields.io/badge/Terraform-1.0.0-brightgreen.svg)

## Project Description

**DevOps Red Line** is a comprehensive project designed to integrate various DevOps tools and practices into a cohesive workflow. This project encompasses both backend and frontend components, utilizing modern frameworks and technologies to ensure a robust and scalable application. 

### Key Features

- **Backend**: Built with Django, providing a RESTful API for data management.
- **Frontend**: Developed using React and Vite for a fast, responsive user interface.
- **Database**: Utilizes PostgreSQL for reliable data storage.
- **Deployment**: Managed through Docker and Terraform, allowing for seamless environment setup and scaling.
- **CI/CD**: Integrated with Jenkins for continuous integration and deployment.

## Tech Stack

| Technology      | Description                       |
|------------------|-----------------------------------|
| ![Python](https://img.shields.io/badge/Python-3.9-blue.svg) | Programming language for backend development. |
| ![Django](https://img.shields.io/badge/Django-3.2-green.svg) | Web framework for building the backend API. |
| ![React](https://img.shields.io/badge/React-17.0.2-blue.svg) | JavaScript library for building user interfaces. |
| ![Vite](https://img.shields.io/badge/Vite-2.6.4-fb4d3d.svg) | Build tool that serves the frontend application. |
| ![PostgreSQL](https://img.shields.io/badge/PostgreSQL-13.3-orange.svg) | Relational database management system. |
| ![Terraform](https://img.shields.io/badge/Terraform-1.0.0-brightgreen.svg) | Infrastructure as code tool for managing cloud resources. |

## Installation Instructions

### Prerequisites

- Python 3.9 or higher
- Node.js 14 or higher
- Docker
- Terraform
- PostgreSQL

### Step-by-Step Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/kalah26/devops_red_line.git
   cd devops_red_line
   ```

2. **Set up the backend**:
   - Navigate to the `Backend/odc` directory.
   - Create a virtual environment:
     ```bash
     python3 -m venv venv
     source venv/bin/activate  # On Windows use `venv\Scripts\activate`
     ```
   - Install dependencies:
     ```bash
     pip install -r requirements.txt
     ```

3. **Set up the frontend**:
   - Navigate to the `Frontend` directory.
   - Install Node.js dependencies:
     ```bash
     npm install
     ```

4. **Environment Variables**:
   - Create a `.env` file in the `Backend/odc` directory and set the following variables:
     ```
     SECRET_KEY=your_secret_key
     DEBUG=True
     DATABASE_URL=postgres://user:password@localhost:5432/dbname
     ```

5. **Run the Backend**:
   - Start the Django server:
     ```bash
     python manage.py migrate
     python manage.py runserver
     ```

6. **Run the Frontend**:
   - Start the Vite development server:
     ```bash
     npm run dev
     ```

## Usage

- Access the backend API at `http://localhost:8000/api/`.
- Access the frontend application at `http://localhost:3000/`.

### Basic Usage Examples

- **Login**: Use the `/api/login` endpoint to authenticate users.
- **Profile Management**: Access `/api/profiles/` to manage user profiles.

## Project Structure

```
devops_red_line/
├── Backend/
│   ├── odc/
│   │   ├── odc/
│   │   │   ├── __init__.py
│   │   │   ├── asgi.py
│   │   │   ├── settings.py
│   │   │   ├── urls.py
│   │   │   └── wsgi.py
│   │   ├── profiles/
│   │   │   ├── admin.py
│   │   │   ├── apps.py
│   │   │   ├── models.py
│   │   │   ├── serializers.py
│   │   │   ├── tests.py
│   │   │   ├── urls.py
│   │   │   └── views.py
│   │   ├── manage.py
│   │   └── requirements.txt
├── Frontend/
│   ├── src/
│   │   ├── components/
│   │   │   └── Navbar.jsx
│   │   ├── pages/
│   │   │   ├── Home.jsx
│   │   │   ├── Login.jsx
│   │   │   ├── Profile.jsx
│   │   │   └── Register.jsx
│   │   ├── App.jsx
│   │   └── main.jsx
├── terraform/
│   ├── main.tf
│   ├── variables.tf
│   ├── outputs.tf
│   └── secrets.tf
└── compose.yml
```

### Explanation of Main Directories

- **Backend/**: Contains the Django backend application, including settings, models, serializers, and views.
- **Frontend/**: Contains the React application, including components and pages.
- **terraform/**: Contains Terraform configuration files for managing infrastructure.
- **compose.yml**: Docker Compose file for orchestrating the application containers.

## Contributing

We welcome contributions to the DevOps Red Line project! Please follow these guidelines:

1. Fork the repository.
2. Create a new branch for your feature or bug fix.
3. Make your changes and commit them.
4. Push to your branch and create a pull request.

Thank you for your interest in contributing!
