using System.Net.Http.Headers;
using Infrastructure.Persistence;
using Domain.Interfaces;
using Infrastructure.Repositories;
using Application.Interfaces;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Infrastructure
{
    public static class DependencyInjection
    {
        public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
        {
            if (configuration == null) throw new ArgumentNullException(nameof(configuration));

            services.AddDbContext<ApplicationDbContext>(options =>
                options.UseNpgsql(
                    configuration.GetConnectionString("DefaultConnection"),
                    b => b.MigrationsAssembly(typeof(ApplicationDbContext).Assembly.FullName)));

            // Bind SMTP settings manually to avoid additional package dependency
            services.Configure<Services.SmtpSettings>(options =>
            {
                var section = configuration.GetSection("SmtpSettings");
                options.Server = section["Server"] ?? string.Empty;
                options.Port = int.TryParse(section["Port"], out var p) ? p : 587;
                options.SenderName = section["SenderName"] ?? string.Empty;
                options.SenderEmail = section["SenderEmail"] ?? string.Empty;
                options.Password = section["Password"] ?? string.Empty;
            });

            // Bind Resend settings
            services.Configure<Services.ResendSettings>(options =>
            {
                var section = configuration.GetSection("ResendSettings");
                options.ApiKey = section["ApiKey"] ?? string.Empty;
                options.FromEmail = section["FromEmail"] ?? string.Empty;
                options.FromName = section["FromName"] ?? string.Empty;
            });

            // Bind Brevo settings
            services.Configure<Services.BrevoSettings>(options =>
            {
                var section = configuration.GetSection("BrevoSettings");
                options.ApiKey = section["ApiKey"] ?? string.Empty;
                options.SenderEmail = section["SenderEmail"] ?? string.Empty;
                options.SenderName = section["SenderName"] ?? string.Empty;
            });

            // Register repositories
            services.AddScoped<IUserRepository, UserRepository>();
            services.AddScoped<IRoleRepository, RoleRepository>();
            services.AddScoped<IProjectRepository, ProjectRepository>();
            services.AddScoped<ITicketRepository, TicketRepository>();
            services.AddScoped<ISprintRepository, SprintRepository>();
            services.AddScoped<ICommentaireRepository, CommentaireRepository>();
            services.AddScoped<IConversationRepository, ConversationRepository>();
            services.AddScoped<IMessageRepository, MessageRepository>();
            services.AddScoped<IChatRepository, ChatRepository>();

            // Email service — conditional registration based on EmailSettings:Provider
            var emailProvider = configuration["EmailSettings:Provider"] ?? "Smtp";
            if (string.Equals(emailProvider, "Resend", StringComparison.OrdinalIgnoreCase))
            {
                services.AddHttpClient("Resend", client =>
                {
                    client.DefaultRequestHeaders.Authorization =
                        new AuthenticationHeaderValue("Bearer", configuration["ResendSettings:ApiKey"] ?? string.Empty);
                });
                services.AddScoped<IEmailService, Services.ResendEmailService>();
            }
            else if (string.Equals(emailProvider, "Brevo", StringComparison.OrdinalIgnoreCase))
            {
                services.AddHttpClient("Brevo", client =>
                {
                    client.DefaultRequestHeaders.Add("api-key", configuration["BrevoSettings:ApiKey"] ?? string.Empty);
                });
                services.AddScoped<IEmailService, Services.BrevoEmailService>();
            }
            else
            {
                services.AddScoped<IEmailService, Services.SmtpEmailService>();
            }
            // File storage (local)
            services.AddScoped<IFileStorageService, Services.LocalFileStorageService>();
            services.AddScoped<IAuthService, Services.AuthService>();
            // Notification service (SignalR + BDD)
            services.AddScoped<INotificationService, Services.NotificationService>();
            // Project authorization service (rôle d'un utilisateur dans un projet)
            services.AddScoped<IProjectAuthorizationService, Services.ProjectAuthorizationService>();
            // Gemini service (génération de plans de projet via IA). Clé lue via IConfiguration (Gemini:ApiKey).
            services.AddHttpClient<IGeminiService, Services.GeminiService>(client =>
            {
                client.Timeout = TimeSpan.FromSeconds(60);
            });

            return services;
        }


    }
}
