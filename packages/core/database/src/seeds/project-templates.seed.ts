import type { NewProjectTemplate } from '../schemas/project-templates.schema'

/**
 * 系统预设的项目模板
 * 包含 5 种常见的应用类型，每个模板都包含完整的 K8s 配置和最佳实践
 */
export const systemTemplates: NewProjectTemplate[] = [
  {
    name: 'React Application',
    slug: 'react-app',
    description: 'Modern React application with Nginx server, optimized for production deployment',
    category: 'web',
    techStack: {
      language: 'TypeScript',
      framework: 'React',
      runtime: 'Nginx',
    },
    defaultConfig: {
      environments: [
        {
          name: 'development',
          type: 'development',
          replicas: 1,
          resources: {
            requests: { cpu: '100m', memory: '128Mi' },
            limits: { cpu: '200m', memory: '256Mi' },
          },
          envVars: {
            NODE_ENV: 'development',
          },
          gitops: {
            enabled: true,
            autoSync: true,
            gitBranch: 'develop',
            gitPath: 'k8s/overlays/development',
            syncInterval: '1m',
          },
        },
        {
          name: 'staging',
          type: 'staging',
          replicas: 2,
          resources: {
            requests: { cpu: '100m', memory: '128Mi' },
            limits: { cpu: '200m', memory: '256Mi' },
          },
          envVars: {
            NODE_ENV: 'staging',
          },
          gitops: {
            enabled: true,
            autoSync: true,
            gitBranch: 'staging',
            gitPath: 'k8s/overlays/staging',
            syncInterval: '5m',
          },
        },
        {
          name: 'production',
          type: 'production',
          replicas: 3,
          resources: {
            requests: { cpu: '100m', memory: '128Mi' },
            limits: { cpu: '200m', memory: '256Mi' },
          },
          envVars: {
            NODE_ENV: 'production',
          },
          gitops: {
            enabled: true,
            autoSync: false,
            gitBranch: 'main',
            gitPath: 'k8s/overlays/production',
            syncInterval: '10m',
          },
        },
      ],
      resources: {
        requests: { cpu: '100m', memory: '128Mi' },
        limits: { cpu: '200m', memory: '256Mi' },
      },
      healthCheck: {
        enabled: true,
        path: '/',
        port: 80,
        initialDelaySeconds: 10,
        periodSeconds: 10,
      },
      gitops: {
        enabled: true,
        autoSync: true,
        syncInterval: '5m',
      },
    },
    k8sTemplates: {
      deployment: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{name}}
  namespace: {{namespace}}
  labels:
    app: {{name}}
    environment: {{environment}}
spec:
  replicas: {{replicas}}
  selector:
    matchLabels:
      app: {{name}}
  template:
    metadata:
      labels:
        app: {{name}}
        environment: {{environment}}
    spec:
      containers:
      - name: app
        image: {{image}}
        ports:
        - containerPort: 80
          name: http
        resources:
          requests:
            cpu: {{resources.requests.cpu}}
            memory: {{resources.requests.memory}}
          limits:
            cpu: {{resources.limits.cpu}}
            memory: {{resources.limits.memory}}
        livenessProbe:
          httpGet:
            path: /
            port: 80
          initialDelaySeconds: 10
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /
            port: 80
          initialDelaySeconds: 5
          periodSeconds: 5
        {{#if envVars}}
        env:
        {{#each envVars}}
        - name: {{@key}}
          value: "{{this}}"
        {{/each}}
        {{/if}}`,
      service: `apiVersion: v1
kind: Service
metadata:
  name: {{name}}
  namespace: {{namespace}}
  labels:
    app: {{name}}
spec:
  type: ClusterIP
  ports:
  - port: 80
    targetPort: 80
    protocol: TCP
    name: http
  selector:
    app: {{name}}`,
      ingress: `apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: {{name}}
  namespace: {{namespace}}
  labels:
    app: {{name}}
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  ingressClassName: nginx
  tls:
  - hosts:
    - {{domain}}
    secretName: {{name}}-tls
  rules:
  - host: {{domain}}
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: {{name}}
            port:
              number: 80`,
    },
    cicdTemplates: {
      githubActions: `name: Deploy to Kubernetes

on:
  push:
    branches: [main, staging, develop]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Build and push Docker image
        run: |
          docker build -t \${{ secrets.REGISTRY }}/{{name}}:\${{ github.sha }} .
          docker push \${{ secrets.REGISTRY }}/{{name}}:\${{ github.sha }}
      
      - name: Update Kubernetes manifests
        run: |
          cd k8s/overlays/\${{ github.ref_name }}
          kustomize edit set image app=\${{ secrets.REGISTRY }}/{{name}}:\${{ github.sha }}
          git config user.name "GitHub Actions"
          git config user.email "actions@github.com"
          git add .
          git commit -m "Update image to \${{ github.sha }}"
          git push`,
    },
    tags: ['react', 'frontend', 'spa', 'nginx'],
    icon: 'react',
    isPublic: true,
    isSystem: true,
  },
  {
    name: 'Node.js API',
    slug: 'nodejs-api',
    description:
      'RESTful API built with Node.js and Express, with health checks and graceful shutdown',
    category: 'api',
    techStack: {
      language: 'TypeScript',
      framework: 'Express',
      runtime: 'Node.js',
    },
    defaultConfig: {
      environments: [
        {
          name: 'development',
          type: 'development',
          replicas: 1,
          resources: {
            requests: { cpu: '200m', memory: '256Mi' },
            limits: { cpu: '500m', memory: '512Mi' },
          },
          envVars: {
            NODE_ENV: 'development',
            PORT: '3000',
            LOG_LEVEL: 'debug',
          },
          gitops: {
            enabled: true,
            autoSync: true,
            gitBranch: 'develop',
            gitPath: 'k8s/overlays/development',
            syncInterval: '1m',
          },
        },
        {
          name: 'staging',
          type: 'staging',
          replicas: 2,
          resources: {
            requests: { cpu: '200m', memory: '256Mi' },
            limits: { cpu: '500m', memory: '512Mi' },
          },
          envVars: {
            NODE_ENV: 'staging',
            PORT: '3000',
            LOG_LEVEL: 'info',
          },
          gitops: {
            enabled: true,
            autoSync: true,
            gitBranch: 'staging',
            gitPath: 'k8s/overlays/staging',
            syncInterval: '5m',
          },
        },
        {
          name: 'production',
          type: 'production',
          replicas: 3,
          resources: {
            requests: { cpu: '200m', memory: '256Mi' },
            limits: { cpu: '500m', memory: '512Mi' },
          },
          envVars: {
            NODE_ENV: 'production',
            PORT: '3000',
            LOG_LEVEL: 'warn',
          },
          gitops: {
            enabled: true,
            autoSync: false,
            gitBranch: 'main',
            gitPath: 'k8s/overlays/production',
            syncInterval: '10m',
          },
        },
      ],
      resources: {
        requests: { cpu: '200m', memory: '256Mi' },
        limits: { cpu: '500m', memory: '512Mi' },
      },
      healthCheck: {
        enabled: true,
        path: '/health',
        port: 3000,
        initialDelaySeconds: 15,
        periodSeconds: 10,
      },
      gitops: {
        enabled: true,
        autoSync: true,
        syncInterval: '5m',
      },
    },
    k8sTemplates: {
      deployment: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{name}}
  namespace: {{namespace}}
  labels:
    app: {{name}}
    environment: {{environment}}
spec:
  replicas: {{replicas}}
  selector:
    matchLabels:
      app: {{name}}
  template:
    metadata:
      labels:
        app: {{name}}
        environment: {{environment}}
    spec:
      containers:
      - name: app
        image: {{image}}
        ports:
        - containerPort: 3000
          name: http
        resources:
          requests:
            cpu: {{resources.requests.cpu}}
            memory: {{resources.requests.memory}}
          limits:
            cpu: {{resources.limits.cpu}}
            memory: {{resources.limits.memory}}
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 15
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 3000
          initialDelaySeconds: 10
          periodSeconds: 5
        {{#if envVars}}
        env:
        {{#each envVars}}
        - name: {{@key}}
          value: "{{this}}"
        {{/each}}
        {{/if}}
        lifecycle:
          preStop:
            exec:
              command: ["/bin/sh", "-c", "sleep 10"]`,
      service: `apiVersion: v1
kind: Service
metadata:
  name: {{name}}
  namespace: {{namespace}}
  labels:
    app: {{name}}
spec:
  type: ClusterIP
  ports:
  - port: 3000
    targetPort: 3000
    protocol: TCP
    name: http
  selector:
    app: {{name}}`,
      ingress: `apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: {{name}}
  namespace: {{namespace}}
  labels:
    app: {{name}}
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/rate-limit: "100"
spec:
  ingressClassName: nginx
  tls:
  - hosts:
    - {{domain}}
    secretName: {{name}}-tls
  rules:
  - host: {{domain}}
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: {{name}}
            port:
              number: 3000`,
    },
    tags: ['nodejs', 'api', 'express', 'backend'],
    icon: 'nodejs',
    isPublic: true,
    isSystem: true,
  },
  {
    name: 'Go Microservice',
    slug: 'go-microservice',
    description: 'Lightweight Go microservice with minimal resource footprint and fast startup',
    category: 'microservice',
    techStack: {
      language: 'Go',
      framework: 'Gin',
      runtime: 'Go',
    },
    defaultConfig: {
      environments: [
        {
          name: 'development',
          type: 'development',
          replicas: 1,
          resources: {
            requests: { cpu: '100m', memory: '64Mi' },
            limits: { cpu: '200m', memory: '128Mi' },
          },
          envVars: {
            ENV: 'development',
            PORT: '8080',
          },
          gitops: {
            enabled: true,
            autoSync: true,
            gitBranch: 'develop',
            gitPath: 'k8s/overlays/development',
            syncInterval: '1m',
          },
        },
        {
          name: 'staging',
          type: 'staging',
          replicas: 2,
          resources: {
            requests: { cpu: '100m', memory: '64Mi' },
            limits: { cpu: '200m', memory: '128Mi' },
          },
          envVars: {
            ENV: 'staging',
            PORT: '8080',
          },
          gitops: {
            enabled: true,
            autoSync: true,
            gitBranch: 'staging',
            gitPath: 'k8s/overlays/staging',
            syncInterval: '5m',
          },
        },
        {
          name: 'production',
          type: 'production',
          replicas: 3,
          resources: {
            requests: { cpu: '100m', memory: '64Mi' },
            limits: { cpu: '200m', memory: '128Mi' },
          },
          envVars: {
            ENV: 'production',
            PORT: '8080',
          },
          gitops: {
            enabled: true,
            autoSync: false,
            gitBranch: 'main',
            gitPath: 'k8s/overlays/production',
            syncInterval: '10m',
          },
        },
      ],
      resources: {
        requests: { cpu: '100m', memory: '64Mi' },
        limits: { cpu: '200m', memory: '128Mi' },
      },
      healthCheck: {
        enabled: true,
        path: '/healthz',
        port: 8080,
        initialDelaySeconds: 5,
        periodSeconds: 10,
      },
      gitops: {
        enabled: true,
        autoSync: true,
        syncInterval: '5m',
      },
    },
    k8sTemplates: {
      deployment: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{name}}
  namespace: {{namespace}}
  labels:
    app: {{name}}
    environment: {{environment}}
spec:
  replicas: {{replicas}}
  selector:
    matchLabels:
      app: {{name}}
  template:
    metadata:
      labels:
        app: {{name}}
        environment: {{environment}}
    spec:
      containers:
      - name: app
        image: {{image}}
        ports:
        - containerPort: 8080
          name: http
        resources:
          requests:
            cpu: {{resources.requests.cpu}}
            memory: {{resources.requests.memory}}
          limits:
            cpu: {{resources.limits.cpu}}
            memory: {{resources.limits.memory}}
        livenessProbe:
          httpGet:
            path: /healthz
            port: 8080
          initialDelaySeconds: 5
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /readyz
            port: 8080
          initialDelaySeconds: 3
          periodSeconds: 5
        {{#if envVars}}
        env:
        {{#each envVars}}
        - name: {{@key}}
          value: "{{this}}"
        {{/each}}
        {{/if}}
        securityContext:
          runAsNonRoot: true
          runAsUser: 1000
          allowPrivilegeEscalation: false
          capabilities:
            drop:
            - ALL`,
      service: `apiVersion: v1
kind: Service
metadata:
  name: {{name}}
  namespace: {{namespace}}
  labels:
    app: {{name}}
spec:
  type: ClusterIP
  ports:
  - port: 8080
    targetPort: 8080
    protocol: TCP
    name: http
  selector:
    app: {{name}}`,
    },
    tags: ['go', 'microservice', 'gin', 'backend'],
    icon: 'go',
    isPublic: true,
    isSystem: true,
  },
  {
    name: 'Python API',
    slug: 'python-api',
    description:
      'Python API with FastAPI framework, async support, and automatic API documentation',
    category: 'api',
    techStack: {
      language: 'Python',
      framework: 'FastAPI',
      runtime: 'Python',
    },
    defaultConfig: {
      environments: [
        {
          name: 'development',
          type: 'development',
          replicas: 1,
          resources: {
            requests: { cpu: '200m', memory: '256Mi' },
            limits: { cpu: '500m', memory: '512Mi' },
          },
          envVars: {
            PYTHON_ENV: 'development',
            PORT: '8000',
            LOG_LEVEL: 'DEBUG',
          },
          gitops: {
            enabled: true,
            autoSync: true,
            gitBranch: 'develop',
            gitPath: 'k8s/overlays/development',
            syncInterval: '1m',
          },
        },
        {
          name: 'staging',
          type: 'staging',
          replicas: 2,
          resources: {
            requests: { cpu: '200m', memory: '256Mi' },
            limits: { cpu: '500m', memory: '512Mi' },
          },
          envVars: {
            PYTHON_ENV: 'staging',
            PORT: '8000',
            LOG_LEVEL: 'INFO',
          },
          gitops: {
            enabled: true,
            autoSync: true,
            gitBranch: 'staging',
            gitPath: 'k8s/overlays/staging',
            syncInterval: '5m',
          },
        },
        {
          name: 'production',
          type: 'production',
          replicas: 3,
          resources: {
            requests: { cpu: '200m', memory: '256Mi' },
            limits: { cpu: '500m', memory: '512Mi' },
          },
          envVars: {
            PYTHON_ENV: 'production',
            PORT: '8000',
            LOG_LEVEL: 'WARNING',
          },
          gitops: {
            enabled: true,
            autoSync: false,
            gitBranch: 'main',
            gitPath: 'k8s/overlays/production',
            syncInterval: '10m',
          },
        },
      ],
      resources: {
        requests: { cpu: '200m', memory: '256Mi' },
        limits: { cpu: '500m', memory: '512Mi' },
      },
      healthCheck: {
        enabled: true,
        path: '/health',
        port: 8000,
        initialDelaySeconds: 15,
        periodSeconds: 10,
      },
      gitops: {
        enabled: true,
        autoSync: true,
        syncInterval: '5m',
      },
    },
    k8sTemplates: {
      deployment: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{name}}
  namespace: {{namespace}}
  labels:
    app: {{name}}
    environment: {{environment}}
spec:
  replicas: {{replicas}}
  selector:
    matchLabels:
      app: {{name}}
  template:
    metadata:
      labels:
        app: {{name}}
        environment: {{environment}}
    spec:
      containers:
      - name: app
        image: {{image}}
        ports:
        - containerPort: 8000
          name: http
        resources:
          requests:
            cpu: {{resources.requests.cpu}}
            memory: {{resources.requests.memory}}
          limits:
            cpu: {{resources.limits.cpu}}
            memory: {{resources.limits.memory}}
        livenessProbe:
          httpGet:
            path: /health
            port: 8000
          initialDelaySeconds: 15
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 8000
          initialDelaySeconds: 10
          periodSeconds: 5
        {{#if envVars}}
        env:
        {{#each envVars}}
        - name: {{@key}}
          value: "{{this}}"
        {{/each}}
        {{/if}}`,
      service: `apiVersion: v1
kind: Service
metadata:
  name: {{name}}
  namespace: {{namespace}}
  labels:
    app: {{name}}
spec:
  type: ClusterIP
  ports:
  - port: 8000
    targetPort: 8000
    protocol: TCP
    name: http
  selector:
    app: {{name}}`,
      ingress: `apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: {{name}}
  namespace: {{namespace}}
  labels:
    app: {{name}}
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  ingressClassName: nginx
  tls:
  - hosts:
    - {{domain}}
    secretName: {{name}}-tls
  rules:
  - host: {{domain}}
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: {{name}}
            port:
              number: 8000`,
    },
    tags: ['python', 'api', 'fastapi', 'backend'],
    icon: 'python',
    isPublic: true,
    isSystem: true,
  },
  {
    name: 'Static Website',
    slug: 'static-website',
    description: 'Static website served by Nginx with minimal resource usage',
    category: 'static',
    techStack: {
      language: 'HTML/CSS/JS',
      framework: 'None',
      runtime: 'Nginx',
    },
    defaultConfig: {
      environments: [
        {
          name: 'development',
          type: 'development',
          replicas: 1,
          resources: {
            requests: { cpu: '50m', memory: '64Mi' },
            limits: { cpu: '100m', memory: '128Mi' },
          },
          envVars: {},
          gitops: {
            enabled: true,
            autoSync: true,
            gitBranch: 'develop',
            gitPath: 'k8s/overlays/development',
            syncInterval: '1m',
          },
        },
        {
          name: 'staging',
          type: 'staging',
          replicas: 2,
          resources: {
            requests: { cpu: '50m', memory: '64Mi' },
            limits: { cpu: '100m', memory: '128Mi' },
          },
          envVars: {},
          gitops: {
            enabled: true,
            autoSync: true,
            gitBranch: 'staging',
            gitPath: 'k8s/overlays/staging',
            syncInterval: '5m',
          },
        },
        {
          name: 'production',
          type: 'production',
          replicas: 3,
          resources: {
            requests: { cpu: '50m', memory: '64Mi' },
            limits: { cpu: '100m', memory: '128Mi' },
          },
          envVars: {},
          gitops: {
            enabled: true,
            autoSync: false,
            gitBranch: 'main',
            gitPath: 'k8s/overlays/production',
            syncInterval: '10m',
          },
        },
      ],
      resources: {
        requests: { cpu: '50m', memory: '64Mi' },
        limits: { cpu: '100m', memory: '128Mi' },
      },
      healthCheck: {
        enabled: true,
        path: '/',
        port: 80,
        initialDelaySeconds: 5,
        periodSeconds: 10,
      },
      gitops: {
        enabled: true,
        autoSync: true,
        syncInterval: '5m',
      },
    },
    k8sTemplates: {
      deployment: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{name}}
  namespace: {{namespace}}
  labels:
    app: {{name}}
    environment: {{environment}}
spec:
  replicas: {{replicas}}
  selector:
    matchLabels:
      app: {{name}}
  template:
    metadata:
      labels:
        app: {{name}}
        environment: {{environment}}
    spec:
      containers:
      - name: nginx
        image: {{image}}
        ports:
        - containerPort: 80
          name: http
        resources:
          requests:
            cpu: {{resources.requests.cpu}}
            memory: {{resources.requests.memory}}
          limits:
            cpu: {{resources.limits.cpu}}
            memory: {{resources.limits.memory}}
        livenessProbe:
          httpGet:
            path: /
            port: 80
          initialDelaySeconds: 5
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /
            port: 80
          initialDelaySeconds: 3
          periodSeconds: 5`,
      service: `apiVersion: v1
kind: Service
metadata:
  name: {{name}}
  namespace: {{namespace}}
  labels:
    app: {{name}}
spec:
  type: ClusterIP
  ports:
  - port: 80
    targetPort: 80
    protocol: TCP
    name: http
  selector:
    app: {{name}}`,
      ingress: `apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: {{name}}
  namespace: {{namespace}}
  labels:
    app: {{name}}
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/force-ssl-redirect: "true"
spec:
  ingressClassName: nginx
  tls:
  - hosts:
    - {{domain}}
    secretName: {{name}}-tls
  rules:
  - host: {{domain}}
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: {{name}}
            port:
              number: 80`,
    },
    tags: ['static', 'html', 'nginx', 'frontend'],
    icon: 'html5',
    isPublic: true,
    isSystem: true,
  },
]
