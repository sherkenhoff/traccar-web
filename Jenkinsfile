pipeline {
    agent {
        docker {
            label 'docker && linux'
            image 'node:20-alpine'
        }
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Build') {
            steps {
                sh '''
                  npm ci
                  npm run build
                '''
            }
        }
        

        stage('Package') {
            steps {
                sh '''
                  tar -C build -czf traccar-web.tar.gz .
                '''
            }
        }

        stage('Archive') {
            steps {
                archiveArtifacts artifacts: 'traccar-web.tar.gz', fingerprint: true
            }
        }
    }
}
