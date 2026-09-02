using System;
using System.Threading;
using System.Threading.Tasks;
using Application.Interfaces;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Infrastructure.Services
{
    public class SprintLifecycleBackgroundService : BackgroundService
    {
        private readonly IServiceProvider _serviceProvider;
        private readonly ILogger<SprintLifecycleBackgroundService> _logger;

        private static readonly TimeSpan CheckInterval = TimeSpan.FromMinutes(1);

        public SprintLifecycleBackgroundService(
            IServiceProvider serviceProvider,
            ILogger<SprintLifecycleBackgroundService> logger)
        {
            _serviceProvider = serviceProvider;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation(
                "SprintLifecycleBackgroundService démarré. Vérification toutes les {Interval} minutes.",
                CheckInterval.TotalMinutes);

            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    using var scope = _serviceProvider.CreateScope();
                    var lifecycleService = scope.ServiceProvider
                        .GetRequiredService<ISprintLifecycleService>();
                    await lifecycleService.CheckSprintLifecycleAsync();
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Erreur lors de la vérification du lifecycle des sprints.");
                }

                await Task.Delay(CheckInterval, stoppingToken);
            }

            _logger.LogInformation("SprintLifecycleBackgroundService arrêté.");
        }
    }
}
