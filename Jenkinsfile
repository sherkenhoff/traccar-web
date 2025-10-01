pipeline {
    agent {
        docker {
            label 'docker && linux'
            image 'node:20-alpine'
            args '-e HOME=/home/jenkins'
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
                  mkdir -p ${HOME}
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
