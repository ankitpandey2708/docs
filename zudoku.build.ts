import type { ZudokuBuildConfig } from "zudoku";

const buildConfig: ZudokuBuildConfig = {
  processors: [
    async ({ schema }) => {
      // Redirect /token endpoint to backend proxy to avoid CORS
      if (schema.paths && schema.paths['/token']) {
        const tokenPath = schema.paths['/token'];
        
        if (tokenPath.post) {
          // Update description to indicate this is proxied
          tokenPath.post.description = (tokenPath.post.description || '') + 
            '\n\n**Note:** This endpoint is proxied through the backend server to avoid CORS issues. The backend handles authentication with Keycloak.';
          
          // IMPORTANT: Delete the servers array from the path so it inherits from operation
          delete tokenPath.servers;
          
          // Set server at operation level with full URL
          tokenPath.post.servers = [
            {
              url: 'http://localhost:3001/api',
              description: 'Backend Proxy Server',
            },
          ];
          
          // Simplify the response to match what backend returns
          if (tokenPath.post.responses && tokenPath.post.responses['200']) {
            tokenPath.post.responses['200'].content = {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    access_token: { type: 'string' },
                    expires_in: { type: 'number' },
                    token_type: { type: 'string' },
                    workspace: { type: 'string' },
                    flowIds: {
                      type: 'object',
                      properties: {
                        nerv: { type: 'string' },
                        recurring: { type: 'string' },
                      },
                    },
                  },
                },
              },
            };
          }
        }
        
        // Rename the path to match backend endpoint
        schema.paths['/token/exchange'] = tokenPath;
        delete schema.paths['/token'];
      }
      
      return schema;
    },
  ],
};

export default buildConfig;
