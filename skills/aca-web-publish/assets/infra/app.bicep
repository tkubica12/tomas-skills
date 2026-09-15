param location string = 'swedencentral'
param appName string
param environmentId string
param identityId string
param identityClientId string
param image string
param registryServer string
param storageAccountName string
param containerName string = 'site'

@allowed(['none', 'github', 'google', 'entra'])
param authProvider string
param allowedUsers string = ''
param publicBaseUrl string = ''

@secure()
param sessionSecret string

@secure()
param providerClientSecret string = ''

param providerClientId string = ''
param entraTenantId string = ''

var providerEnv = authProvider == 'none' ? [] : [
  {
    name: '${toUpper(authProvider)}_CLIENT_ID'
    value: providerClientId
  }
  {
    name: '${toUpper(authProvider)}_CLIENT_SECRET'
    secretRef: 'oauth-client'
  }
]

resource app 'Microsoft.App/containerApps@2026-03-02-preview' = {
  name: appName
  location: location
  tags: {
    purpose: 'aca-web-publish'
  }
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${identityId}': {}
    }
  }
  properties: {
    environmentId: environmentId
    configuration: {
      activeRevisionsMode: 'Single'
      ingress: {
        external: true
        targetPort: 8000
        transport: 'http'
        allowInsecure: false
      }
      registries: [
        {
          server: registryServer
          identity: identityId
        }
      ]
      secrets: concat([
        {
          name: 'session'
          value: sessionSecret
        }
      ], authProvider == 'none' ? [] : [
        {
          name: 'oauth-client'
          value: providerClientSecret
        }
      ])
    }
    template: {
      containers: [
        {
          name: 'web'
          image: image
          resources: {
            cpu: json('0.25')
            memory: '0.5Gi'
          }
          env: concat([
            {
              name: 'STORAGE_ACCOUNT_NAME'
              value: storageAccountName
            }
            {
              name: 'BLOB_CONTAINER_NAME'
              value: containerName
            }
            {
              name: 'AZURE_CLIENT_ID'
              value: identityClientId
            }
            {
              name: 'AUTH_PROVIDER'
              value: authProvider
            }
            {
              name: 'ALLOWED_USERS'
              value: allowedUsers
            }
            {
              name: 'PUBLIC_BASE_URL'
              value: publicBaseUrl
            }
            {
              name: 'SESSION_SECRET'
              secretRef: 'session'
            }
            {
              name: 'UPLOAD_API_ENABLED'
              value: 'false'
            }
            {
              name: 'ENTRA_TENANT_ID'
              value: entraTenantId
            }
          ], providerEnv)
          probes: [
            {
              type: 'Liveness'
              httpGet: {
                path: '/healthz'
                port: 8000
              }
              periodSeconds: 30
            }
            {
              type: 'Readiness'
              httpGet: {
                path: '/healthz'
                port: 8000
              }
              periodSeconds: 10
            }
          ]
        }
      ]
      scale: {
        minReplicas: 0
        maxReplicas: 1
        rules: [
          {
            name: 'http'
            http: {
              metadata: {
                concurrentRequests: '50'
              }
            }
          }
        ]
      }
    }
  }
}

output url string = 'https://${app.properties.configuration.ingress.fqdn}'
