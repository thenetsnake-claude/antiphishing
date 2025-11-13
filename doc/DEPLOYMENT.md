# Deployment Documentation

## Overview

This document covers deployment strategies for both development and production environments.

## Prerequisites

### Development
- Node.js 22.x
- Docker and Docker Compose
- Git

### Production (Kubernetes)
- Kubernetes cluster (1.24+)
- kubectl configured
- Access to external Redis with Sentinel
- Container registry access

## Environment Variables

### Required Environment Variables

| Variable | Development | Production | Description |
|----------|-------------|------------|-------------|
| NODE_ENV | development | production | Environment mode |
| PORT | 3000 | 3000 | API port |
| REDIS_HOST | localhost | - | Redis host (dev only) |
| REDIS_PORT | 6379 | - | Redis port (dev only) |
| REDIS_SENTINEL_HOSTS | - | Required | Comma-separated sentinel hosts |
| REDIS_MASTER_NAME | - | Required | Redis master name |
| REDIS_USERNAME | - | Required | Redis username |
| REDIS_PASSWORD | - | Required | Redis password |
| REDIS_TLS_ENABLED | false | true | Enable TLS for Redis |
| LOG_LEVEL | debug | info | Logging level |
| LOG_FILE_PATH | ./logs | /var/log/app | Log file directory |

### Environment Variable Examples

**Development (.env)**:
```env
NODE_ENV=development
PORT=3000
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_TLS_ENABLED=false
LOG_LEVEL=debug
LOG_FILE_PATH=./logs
```

**Production (Kubernetes Secret/ConfigMap)**:
```env
NODE_ENV=production
PORT=3000
REDIS_SENTINEL_HOSTS=sentinel-1.redis.svc.cluster.local:26379,sentinel-2.redis.svc.cluster.local:26379,sentinel-3.redis.svc.cluster.local:26379
REDIS_MASTER_NAME=mymaster
REDIS_USERNAME=antiphishing-api
REDIS_PASSWORD=<from-secret>
REDIS_TLS_ENABLED=true
LOG_LEVEL=info
LOG_FILE_PATH=/var/log/app
```

## Development Deployment

### Option 1: Local Development (without Docker)

1. **Install dependencies**:
```bash
npm install
```

2. **Set up environment**:
```bash
cp .env.example .env
# Edit .env with your local settings
```

3. **Start local Redis**:
```bash
docker run -d -p 6379:6379 --name redis redis:7-alpine
```

4. **Run in development mode**:
```bash
npm run start:dev
```

5. **Run tests**:
```bash
npm test
```

6. **Check coverage**:
```bash
npm run test:cov
```

### Option 2: Docker Compose (Recommended)

1. **Set up environment**:
```bash
cp .env.example .env
# Default values should work for Docker Compose
```

2. **Start all services**:
```bash
docker-compose up -d
```

3. **View logs**:
```bash
docker-compose logs -f api
```

4. **Stop services**:
```bash
docker-compose down
```

5. **Rebuild after changes**:
```bash
docker-compose up -d --build
```

### Docker Compose Configuration

The `docker-compose.yml` includes:
- **api**: NestJS application with hot reload
- **redis**: Redis 7.x for caching

**Volumes**:
- `./src:/app/src` - Hot reload for development
- `./logs:/app/logs` - Log persistence
- `redis-data:/data` - Redis persistence

**Networks**:
- Internal network for service communication

## Production Deployment (Kubernetes)

### Prerequisites

1. **External Redis Setup**:
   - Redis cluster with Sentinel
   - TLS certificates configured
   - User credentials created
   - Network access configured

2. **Container Registry**:
   - Docker image built and pushed
   - Registry credentials configured in K8s

### Step 1: Build Docker Image

```bash
# Build the image
docker build -t your-registry.com/antiphishing-api:v1.0.0 .

# Tag for latest
docker tag your-registry.com/antiphishing-api:v1.0.0 your-registry.com/antiphishing-api:latest

# Push to registry
docker push your-registry.com/antiphishing-api:v1.0.0
docker push your-registry.com/antiphishing-api:latest
```

### Step 2: Create Kubernetes Resources

#### 2.1 Create Namespace

```yaml
# namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: antiphishing
```

```bash
kubectl apply -f namespace.yaml
```

#### 2.2 Create ConfigMap

```yaml
# configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: antiphishing-config
  namespace: antiphishing
data:
  NODE_ENV: "production"
  PORT: "3000"
  REDIS_SENTINEL_HOSTS: "sentinel-1.redis.svc.cluster.local:26379,sentinel-2.redis.svc.cluster.local:26379,sentinel-3.redis.svc.cluster.local:26379"
  REDIS_MASTER_NAME: "mymaster"
  REDIS_TLS_ENABLED: "true"
  LOG_LEVEL: "info"
  LOG_FILE_PATH: "/var/log/app"
```

```bash
kubectl apply -f configmap.yaml
```

#### 2.3 Create Secret

```yaml
# secret.yaml
apiVersion: v1
kind: Secret
metadata:
  name: antiphishing-secret
  namespace: antiphishing
type: Opaque
stringData:
  REDIS_USERNAME: "antiphishing-api"
  REDIS_PASSWORD: "your-secure-password-here"
```

```bash
kubectl apply -f secret.yaml
```

#### 2.4 Create Deployment

```yaml
# deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: antiphishing-api
  namespace: antiphishing
  labels:
    app: antiphishing-api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: antiphishing-api
  template:
    metadata:
      labels:
        app: antiphishing-api
    spec:
      containers:
      - name: api
        image: your-registry.com/antiphishing-api:v1.0.0
        ports:
        - containerPort: 3000
          name: http
        envFrom:
        - configMapRef:
            name: antiphishing-config
        - secretRef:
            name: antiphishing-secret
        resources:
          requests:
            cpu: 100m
            memory: 256Mi
          limits:
            cpu: 500m
            memory: 512Mi
        livenessProbe:
          httpGet:
            path: /health/liveness
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 3
        readinessProbe:
          httpGet:
            path: /health/readiness
            port: 3000
          initialDelaySeconds: 10
          periodSeconds: 5
          timeoutSeconds: 3
          failureThreshold: 3
        volumeMounts:
        - name: logs
          mountPath: /var/log/app
      volumes:
      - name: logs
        emptyDir: {}
```

```bash
kubectl apply -f deployment.yaml
```

#### 2.5 Create Service

```yaml
# service.yaml
apiVersion: v1
kind: Service
metadata:
  name: antiphishing-api
  namespace: antiphishing
  labels:
    app: antiphishing-api
spec:
  type: ClusterIP
  ports:
  - port: 80
    targetPort: 3000
    protocol: TCP
    name: http
  selector:
    app: antiphishing-api
```

```bash
kubectl apply -f service.yaml
```

#### 2.6 Create Ingress (Optional)

```yaml
# ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: antiphishing-api
  namespace: antiphishing
  annotations:
    kubernetes.io/ingress.class: nginx
    cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  tls:
  - hosts:
    - api.yourdomain.com
    secretName: antiphishing-tls
  rules:
  - host: api.yourdomain.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: antiphishing-api
            port:
              number: 80
```

```bash
kubectl apply -f ingress.yaml
```

### Step 3: Verify Deployment

```bash
# Check pod status
kubectl get pods -n antiphishing

# Check logs
kubectl logs -n antiphishing -l app=antiphishing-api --tail=100

# Check service
kubectl get svc -n antiphishing

# Test health endpoint
kubectl port-forward -n antiphishing svc/antiphishing-api 3000:80
curl http://localhost:3000/health
```

### Step 4: Monitor Deployment

```bash
# Watch pod status
kubectl get pods -n antiphishing -w

# Describe pod for issues
kubectl describe pod -n antiphishing <pod-name>

# View events
kubectl get events -n antiphishing --sort-by='.lastTimestamp'
```

## Scaling

### Horizontal Pod Autoscaling

```yaml
# hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: antiphishing-api
  namespace: antiphishing
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: antiphishing-api
  minReplicas: 3
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

```bash
kubectl apply -f hpa.yaml
```

## Rolling Updates

### Update Deployment Image

```bash
# Update image
kubectl set image deployment/antiphishing-api api=your-registry.com/antiphishing-api:v1.1.0 -n antiphishing

# Watch rollout status
kubectl rollout status deployment/antiphishing-api -n antiphishing

# Check rollout history
kubectl rollout history deployment/antiphishing-api -n antiphishing
```

### Rollback Deployment

```bash
# Rollback to previous version
kubectl rollout undo deployment/antiphishing-api -n antiphishing

# Rollback to specific revision
kubectl rollout undo deployment/antiphishing-api --to-revision=2 -n antiphishing
```

## Logging

### View Logs

**Development**:
```bash
# Docker Compose
docker-compose logs -f api

# Local
tail -f logs/application-*.log
```

**Production (Kubernetes)**:
```bash
# Recent logs
kubectl logs -n antiphishing -l app=antiphishing-api --tail=100

# Follow logs
kubectl logs -n antiphishing -l app=antiphishing-api -f

# Specific pod
kubectl logs -n antiphishing <pod-name>
```

### Log Aggregation (Production)

Consider integrating with:
- **ELK Stack** (Elasticsearch, Logstash, Kibana)
- **Fluentd** for log collection
- **Grafana Loki** for log aggregation
- **CloudWatch/Stackdriver** for cloud providers

## Monitoring

### Health Checks

**Local**:
```bash
curl http://localhost:3000/health
curl http://localhost:3000/health/readiness
curl http://localhost:3000/health/liveness
```

**Kubernetes**:
```bash
kubectl port-forward -n antiphishing svc/antiphishing-api 3000:80
curl http://localhost:3000/health
```

### Metrics (Future Enhancement)

Integrate Prometheus for metrics:
- Request rate
- Error rate
- Response time percentiles
- Cache hit rate
- Active connections

## Backup and Recovery

### Redis Backup

Since Redis is external, follow your Redis provider's backup procedures:
- RDB snapshots
- AOF persistence
- Sentinel configurations

### Application State

The application is stateless - no backup needed. All state is in Redis cache (temporary, 60s TTL).

## Troubleshooting

### Common Issues

#### 1. Pod CrashLoopBackOff

```bash
# Check logs
kubectl logs -n antiphishing <pod-name>

# Check events
kubectl describe pod -n antiphishing <pod-name>

# Common causes:
# - Missing environment variables
# - Cannot connect to Redis
# - Invalid configuration
```

#### 2. Redis Connection Failed

```bash
# Check Redis connectivity
kubectl run -it --rm debug --image=redis:7-alpine --restart=Never -- redis-cli -h sentinel-1.redis.svc.cluster.local -p 26379 ping

# Verify Sentinel configuration
kubectl run -it --rm debug --image=redis:7-alpine --restart=Never -- redis-cli -h sentinel-1.redis.svc.cluster.local -p 26379 SENTINEL get-master-addr-by-name mymaster
```

**Solution**:
- Verify REDIS_SENTINEL_HOSTS is correct
- Check network policies allow traffic
- Verify credentials are correct
- Check TLS configuration

#### 3. Health Check Failures

```bash
# Check if port is accessible
kubectl port-forward -n antiphishing <pod-name> 3000:3000
curl http://localhost:3000/health
```

**Solution**:
- Verify PORT environment variable
- Check application logs
- Verify health endpoint implementation

#### 4. High Memory Usage

```bash
# Check resource usage
kubectl top pods -n antiphishing
```

**Solution**:
- Increase memory limits
- Check for memory leaks
- Review application logs

## Security Best Practices

### Production Security Checklist

- [ ] Use non-root user in container
- [ ] Enable TLS for Redis connections
- [ ] Store secrets in Kubernetes Secrets
- [ ] Use network policies to restrict traffic
- [ ] Enable pod security policies
- [ ] Regularly update base images
- [ ] Scan images for vulnerabilities
- [ ] Use private container registry
- [ ] Implement RBAC for Kubernetes access
- [ ] Enable audit logging
- [ ] Use encrypted volumes for logs
- [ ] Rotate credentials regularly

## CI/CD Integration

### GitHub Actions Example

```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches:
      - main

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Build Docker image
        run: docker build -t ${{ secrets.REGISTRY }}/antiphishing-api:${{ github.sha }} .

      - name: Push to registry
        run: |
          echo ${{ secrets.REGISTRY_PASSWORD }} | docker login -u ${{ secrets.REGISTRY_USERNAME }} --password-stdin
          docker push ${{ secrets.REGISTRY }}/antiphishing-api:${{ github.sha }}

      - name: Deploy to Kubernetes
        run: |
          kubectl set image deployment/antiphishing-api api=${{ secrets.REGISTRY }}/antiphishing-api:${{ github.sha }} -n antiphishing
```

## Disaster Recovery

### Recovery Procedures

1. **Application Failure**:
   - Kubernetes automatically restarts failed pods
   - Rollback to previous version if needed

2. **Redis Failure**:
   - Sentinel automatically fails over to replica
   - API continues without cache (graceful degradation)

3. **Complete Cluster Failure**:
   - Deploy to backup cluster
   - Update DNS to point to backup
   - Restore Redis from backup if needed

## Performance Tuning

### Node.js Optimization

```dockerfile
# In Dockerfile
ENV NODE_OPTIONS="--max-old-space-size=512"
```

### Redis Connection Pooling

Configure in application:
```typescript
{
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  enableOfflineQueue: false,
  connectTimeout: 10000,
}
```

### Kubernetes Resource Limits

Adjust based on load testing:
```yaml
resources:
  requests:
    cpu: 200m
    memory: 512Mi
  limits:
    cpu: 1000m
    memory: 1Gi
```

## Load Testing

### Apache Bench
```bash
ab -n 1000 -c 10 -p payload.json -T application/json http://localhost:3000/analyze
```

### K6
```bash
k6 run load-test.js
```

## Support and Maintenance

### Regular Maintenance Tasks

- [ ] Weekly: Review logs for errors
- [ ] Weekly: Check resource usage
- [ ] Monthly: Update dependencies
- [ ] Monthly: Review and rotate credentials
- [ ] Quarterly: Load testing
- [ ] Quarterly: Disaster recovery drill

### Monitoring Checklist

- [ ] Set up alerting for pod failures
- [ ] Set up alerting for high error rates
- [ ] Set up alerting for high latency
- [ ] Set up alerting for Redis connection issues
- [ ] Monitor disk usage for logs

## References

- [Kubernetes Documentation](https://kubernetes.io/docs/)
- [Docker Documentation](https://docs.docker.com/)
- [Redis Sentinel Documentation](https://redis.io/topics/sentinel)
- [NestJS Production Deployment](https://docs.nestjs.com/faq/serverless)
