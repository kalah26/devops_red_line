pipeline {
    agent any

    environment {
        DOCKER_HUB_CREDENTIALS = '93a241e5-5711-4611-9afc-02d46945a4ae' 
        DOCKERHUB_USER = 'genecodo'       
    }

    stages {
        stage('Checkout') {
            steps {
                echo "Cloning red_line's repository from git📥"
                checkout scm 
            }
        }

        stage('Building Backend (Django)...') {
            steps {
                dir('./Backend/odc') {
                    echo "Creating the virtual environn⚙️"
                    // sh '''
                    //     python3 -m venv venv
                    //     . venv/bin/activate
                    //     pip install --upgrade pip
                    //     pip install -r requirements.txt
                    //     python manage.py test
                    // '''
                }
            }
        }

        stage('Building Frontend (React)...') {
            steps {
                dir('./Frontend') {
                    echo "⚙️ Installing the frontend part"
                    // sh '''
                    //     export PATH=$PATH:/var/lib/jenkins/.nvm/versions/node/v22.15.0/bin/
                    //     npm install
                    //     npm run build
                    //    # npm test -- --watchAll=false
                    // '''
                }
            }
        }

        stage('Build Docker Images') {
            steps {
                script {
                    echo "🐳 Building the backend image"
                    sh "docker build -t ${DOCKERHUB_USER}/backend_red_line:latest -f ./Backend/odc ./Backend/odc"

                    echo "🐳 CBuilding the frontend image"
                    sh "docker build -t ${DOCKERHUB_USER}/frontend_red_line:latest -f ./Frontend ./Frontend"
                }
            }
        }

        stage('Pushing to Docker Hub') {
            steps {
                echo "Pushing images to Docker Hub 🚀"
                withCredentials([usernamePassword(credentialsId: "${DOCKER_HUB_CREDENTIALS}", usernameVariable: 'DOCKER_USER', passwordVariable: 'DOCKER_PASS')]) {
                    sh '''
                        echo "$DOCKER_PASS" | docker login -u "$DOCKER_USER" --password-stdin
                        docker push $DOCKER_USER/backend_red_line:latest
                        docker push $DOCKER_USER/frontend_red_line:latest
                    '''
                }
            }
        }
        stage('run'){
            steps{
                dir('cd ..'){
                sh '''
                docker-compose down || true
                docker-compose build
                docker-compose up
                '''
                }
            }
        }
    }

    // post {
    //     success {
    //         echo "CI/CD successfully runned ✅"
    //     }
    //     failure {
    //         echo "Your Pipeline failes❌"
    //     }
    // }
}
