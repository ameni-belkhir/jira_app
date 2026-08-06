using Infrastructure;
using Infrastructure.Hubs;
using Presentation;
using Application;
using Serilog;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using Microsoft.OpenApi.Models;

var builder = WebApplication.CreateBuilder(args);

// Charge le fichier LOCAL non versionné (gitignored) pour les secrets de développement
// (ex: Gemini:ApiKey). Ne jamais commiter ce fichier. Alternative : dotnet user-secrets.
builder.Configuration.AddJsonFile("appsettings.Local.json", optional: true, reloadOnChange: true);

// Add services to the container.

// Register controllers from the Presentation (API) assembly so MVC discovers them
// Register controllers from the Presentation (API) assembly so MVC discovers them
builder.Services.AddControllers()
    .AddJsonOptions(x => x.JsonSerializerOptions.ReferenceHandler = ReferenceHandler.IgnoreCycles);
// Learn more about configuring Swagger/OpenAPI at https://aka.ms/aspnetcore/swashbuckle
builder.Services.AddEndpointsApiExplorer();
// SignalR pour les notifications temps réel
builder.Services.AddSignalR();
// Ensure Swagger includes operations from controllers in referenced assemblies
builder.Services.AddSwaggerGen(options =>
{
    options.DocInclusionPredicate((docName, apiDesc) => true);
    // Add JWT Bearer definition for Swagger
    options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        In = ParameterLocation.Header,
        Description = "Enter 'Bearer' [space] and then your valid token in the text input below."
    });
    options.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" }
            },
            new string[] { }
        }
    });
    // Map IFormFile to a binary string schema so Swagger can describe file uploads
    options.MapType<Microsoft.AspNetCore.Http.IFormFile>(() => new OpenApiSchema
    {
        Type = "string",
        Format = "binary"
    });
    // Support file uploads (IFormFile) in Swagger UI
    options.OperationFilter<Jira_APP.Swagger.SwaggerFileOperationFilter>();
});
builder.Services
    .AddInfrastructure(builder.Configuration)
    .AddPresentation()
    .AddApplication();

// CORS policy for Angular client
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAngularApp", policy =>
    {
        policy.WithOrigins("http://localhost:4200", "https://localhost:4200")
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("AdminOnly", policy => policy.RequireRole("Admin"));
});

// JWT Authentication
var jwtSecret = builder.Configuration["Jwt:SecretKey"];
if (!string.IsNullOrEmpty(jwtSecret))
{
    var key = Encoding.UTF8.GetBytes(jwtSecret);
builder.Services.AddAuthentication(options =>
    {
        options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
        options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
    }).AddJwtBearer(options =>
    {
        options.RequireHttpsMetadata = false;
        options.SaveToken = true;
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = builder.Configuration["Jwt:Issuer"],
            ValidAudience = builder.Configuration["Jwt:Audience"],
            IssuerSigningKey = new SymmetricSecurityKey(key)
        };

        // Important pour SignalR : extraire le token JWT depuis la query string
        // car les connexions WebSocket ne peuvent pas passer de headers HTTP
        options.Events = new JwtBearerEvents
        {
            OnMessageReceived = context =>
            {
                var accessToken = context.Request.Query["access_token"];
                var path = context.HttpContext.Request.Path;

                if (!string.IsNullOrEmpty(accessToken) && path.StartsWithSegments("/hubs/notifications"))
                {
                    context.Token = accessToken;
                }
                return Task.CompletedTask;
            }
        };
    });
}
builder.Host.UseSerilog((context, configuration) =>
{
    configuration.ReadFrom.Configuration(context.Configuration);
});
var app = builder.Build();

// Configure the HTTP request pipeline.
// Expose Swagger UI at application root so it s'ouvre au démarrage.
app.UseSwagger();
app.UseSwaggerUI(c =>
{
    // Ensure the Swagger endpoint name matches expected value and
    // make the UI available at /swagger so launchSettings.json "launchUrl": "swagger" works.
    c.SwaggerEndpoint("/swagger/v1/swagger.json", "Jira API v1");
    c.RoutePrefix = "swagger";
});

app.UseSerilogRequestLogging();

app.UseHttpsRedirection();

// Serve static files (wwwroot) for profile images and other assets
app.UseStaticFiles();

// Enable CORS for Angular client before authentication/authorization
app.UseCors("AllowAngularApp");

// Activer WebSockets pour SignalR (fallback LongPolling si WebSocket échoue)
app.UseWebSockets();

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

// Hub SignalR pour les notifications en temps réel
app.MapHub<NotificationHub>("/hubs/notifications");

// Hub SignalR pour la messagerie temps réel (type Messenger/Slack)
app.MapHub<ChatHub>("/hubs/chat");

app.Run();
