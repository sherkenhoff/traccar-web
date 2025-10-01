pipeline {
    agent {
        docker {
            label 'docker && linux'
            image 'node:20-alpine'
        }
    }

    stages {
        stage('Prepare Workspace') {
            steps {
                cleanWs()

                dir('traccar') {
                    git url: 'https://github.com/sherkenhoff/traccar.git',
                        branch: 'add-radius-search'
                }

                dir('traccar/traccar-web') {
                    deleteDir()
                }

                dir('traccar/traccar-web') {
                    checkout scm
                }
            }
        }

        stage('Build') {
            steps {
                dir('traccar/traccar-web') {
                    sh '''
                      npm ci --prefer-offline --no-audit --no-fund --cache /tmp/npm-cache
                      npm run build
                    '''
                }
            }
        }
        

        stage('Package') {
            steps {
                dir('traccar/traccar-web') {
                    sh '''
                      tar -C build -czf traccar-web.tar.gz .
                    '''
                }
            }
        }

        stage('Archive') {
            steps {
                archiveArtifacts artifacts: 'traccar-web.tar.gz', fingerprint: true
            }
        }
    }
}
