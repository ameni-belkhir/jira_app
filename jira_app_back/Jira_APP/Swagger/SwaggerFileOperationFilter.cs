using System.Linq;
using System.Collections.Generic;
using Microsoft.AspNetCore.Http;
using Microsoft.OpenApi.Models;
using Swashbuckle.AspNetCore.SwaggerGen;

namespace Jira_APP.Swagger
{
    public class SwaggerFileOperationFilter : IOperationFilter
    {
        public void Apply(OpenApiOperation operation, OperationFilterContext context)
        {
            var fileParameters = context.MethodInfo.GetParameters()
                .Where(p => p.ParameterType == typeof(IFormFile) ||
                            p.ParameterType == typeof(IEnumerable<IFormFile>) ||
                            p.ParameterType == typeof(List<IFormFile>))
                .ToList();

            if (!fileParameters.Any()) return;

            operation.RequestBody = operation.RequestBody ?? new OpenApiRequestBody();
            var media = new OpenApiMediaType
            {
                Schema = new OpenApiSchema
                {
                    Type = "object",
                    Properties = fileParameters.ToDictionary(
                        p => p.Name,
                        p => (OpenApiSchema)new OpenApiSchema { Type = "string", Format = "binary" }
                    )
                }
            };

            operation.RequestBody.Content = operation.RequestBody.Content ?? new Dictionary<string, OpenApiMediaType>();
            operation.RequestBody.Content["multipart/form-data"] = media;
        }
    }
}
