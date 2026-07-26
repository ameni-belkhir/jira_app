using System;
using System.Collections.Generic;
using System.Net;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using Microsoft.EntityFrameworkCore;

namespace Jira_APP.Middleware
{
    /// <summary>
    /// Global exception handling middleware that returns RFC7807 ProblemDetails responses.
    /// Maps known exception types to appropriate HTTP status codes and logs errors.
    /// </summary>
    public class ExceptionMiddleware
    {
        private readonly RequestDelegate _next;
        private readonly ILogger<ExceptionMiddleware> _logger;

        public ExceptionMiddleware(RequestDelegate next, ILogger<ExceptionMiddleware> logger)
        {
            _next = next ?? throw new ArgumentNullException(nameof(next));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        public async Task InvokeAsync(HttpContext context)
        {
            try
            {
                await _next(context);
            }
            catch (Exception ex)
            {
                await HandleExceptionAsync(context, ex);
            }
        }

        private async Task HandleExceptionAsync(HttpContext context, Exception exception)
        {
            var status = MapExceptionToStatusCode(exception);

            var problem = new ProblemDetails
            {
                Type = "https://tools.ietf.org/html/rfc7231#section-6.6.1",
                Title = GetTitleForStatusCode(status),
                Status = (int)status,
                Detail = exception.Message,
                Instance = context.Request.Path
            };

            // Add trace identifier
            problem.Extensions["traceId"] = context.TraceIdentifier;

            // Log with appropriate level
            if ((int)status >= 500)
            {
                _logger.LogError(exception, "Unhandled exception for request {Method} {Path}", context.Request.Method, context.Request.Path);
            }
            else
            {
                _logger.LogWarning(exception, "Handled exception for request {Method} {Path}: {Message}", context.Request.Method, context.Request.Path, exception.Message);
            }

            context.Response.ContentType = "application/problem+json";
            context.Response.StatusCode = (int)status;

            var options = new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };
            var json = JsonSerializer.Serialize(problem, options);
            await context.Response.WriteAsync(json);
        }

        private static HttpStatusCode MapExceptionToStatusCode(Exception ex)
        {
            return ex switch
            {
                ArgumentNullException _ => HttpStatusCode.BadRequest,
                ArgumentException _ => HttpStatusCode.BadRequest,
                InvalidOperationException _ => HttpStatusCode.BadRequest,
                UnauthorizedAccessException _ => HttpStatusCode.Unauthorized,
                KeyNotFoundException _ => HttpStatusCode.NotFound,
                DbUpdateException _ => HttpStatusCode.Conflict,
                _ => HttpStatusCode.InternalServerError
            };
        }

        private static string GetTitleForStatusCode(HttpStatusCode status)
        {
            return status switch
            {
                HttpStatusCode.BadRequest => "Bad Request",
                HttpStatusCode.Unauthorized => "Unauthorized",
                HttpStatusCode.NotFound => "Not Found",
                HttpStatusCode.Conflict => "Conflict",
                HttpStatusCode.InternalServerError => "An unexpected error occurred",
                _ => "Error"
            };
        }
    }
}
