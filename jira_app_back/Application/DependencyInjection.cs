using Microsoft.Extensions.DependencyInjection;
using MediatR;
using FluentValidation;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Domain.Interfaces;
using Application.Interfaces;
using Application.Services;


namespace Application
{
    public static class DependencyInjection
    {
        public static IServiceCollection AddApplication(this IServiceCollection services)
        {
            var assembly = typeof(DependencyInjection).Assembly;

            services.AddMediatR(configuration =>
                configuration.RegisterServicesFromAssembly(assembly));

            // Register FluentValidation validators found in the Application assembly
            var validatorInterface = typeof(FluentValidation.IValidator<>);
            var types = assembly.GetTypes()
                .Where(t => !t.IsAbstract && t.GetInterfaces().Any(i => i.IsGenericType && i.GetGenericTypeDefinition() == validatorInterface));

            foreach (var impl in types)
            {
                var serviceInterfaces = impl.GetInterfaces().Where(i => i.IsGenericType && i.GetGenericTypeDefinition() == validatorInterface);
                foreach (var service in serviceInterfaces)
                {
                    services.AddTransient(service, impl);
                }
            }

            // Register application services
            services.AddScoped<IUserService, UserService>();
            services.AddScoped<IRoleService, RoleService>();
            services.AddScoped<IProjectService, ProjectService>();
            services.AddScoped<ITicketService, TicketService>();
            services.AddScoped<ISprintService, SprintService>();
            services.AddScoped<ICommentaireService, CommentaireService>();
            services.AddScoped<IConversationService, ConversationService>();
            services.AddScoped<IMessageService, MessageService>();

            return services;
        }
    }
}
