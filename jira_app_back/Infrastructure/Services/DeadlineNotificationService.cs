using System;
using System.Linq;
using System.Threading.Tasks;
using Application.Interfaces;
using Domain.Entity;
using Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Infrastructure.Services
{
    public class DeadlineNotificationService : IDeadlineNotificationService
    {
        private readonly ApplicationDbContext _context;
        private readonly INotificationService _notificationService;
        private readonly ILogger<DeadlineNotificationService> _logger;

        public DeadlineNotificationService(
            ApplicationDbContext context,
            INotificationService notificationService,
            ILogger<DeadlineNotificationService> logger)
        {
            _context = context;
            _notificationService = notificationService;
            _logger = logger;
        }

        public async Task CheckAndSendDeadlineNotificationsAsync()
        {
            var utcNow = DateTime.UtcNow;
            var threshold30Min = utcNow.AddMinutes(30);

            // Tickets avec échéance dans ≤ 30 minutes OU déjà dépassée, qui ne sont pas terminés
            var ticketsWithDueDate = await _context.Tickets
                .AsNoTracking()
                .Where(t => t.DateEcheance.HasValue
                    && t.Status != Domain.Entity.Status.TERMINE)
                .ToListAsync();

            foreach (var ticket in ticketsWithDueDate)
            {
                var due = ticket.DateEcheance!.Value;
                var windowStart = due.AddMinutes(-30);

                // A. Échéance proche : utcNow >= (due - 30min) && utcNow < due
                if (utcNow >= windowStart && utcNow < due)
                {
                    await SendDeadlineNotificationAsync(
                        ticket,
                        "deadline_approaching",
                        "Échéance proche",
                        $"Le ticket « {ticket.Titre} » arrive à échéance dans moins de 30 minutes.");
                }

                // B. Échéance dépassée : utcNow >= due
                if (utcNow >= due)
                {
                    await SendDeadlineNotificationAsync(
                        ticket,
                        "deadline_passed",
                        "Échéance dépassée",
                        $"Le ticket « {ticket.Titre} » a dépassé sa date d'échéance.");
                }
            }
        }

        private async Task SendDeadlineNotificationAsync(
            Ticket ticket,
            string notifType,
            string title,
            string message)
        {
            // Récupérer les IDs des destinataires (Admin, Senior, ScrumMaster) dans le projet
            if (!ticket.ProjectId.HasValue) return;

            var recipientUserIds = await _context.ProjectMembers
                .AsNoTracking()
                .Where(pm => pm.ProjectId == ticket.ProjectId.Value
                    && (pm.RoleInProject == "Admin"
                        || pm.RoleInProject == "Senior"
                        || pm.RoleInProject == "ScrumMaster"))
                .Select(pm => pm.UserId)
                .ToListAsync();

            // Ajouter les Admins globaux qui ne sont pas déjà dans la liste
            var globalAdminIds = await _context.Users
                .AsNoTracking()
                .Where(u => u.Role.Description == "Admin"
                    && !recipientUserIds.Contains(u.Id))
                .Select(u => u.Id)
                .ToListAsync();

            recipientUserIds.AddRange(globalAdminIds);

            var targetUrl = $"/projects/{ticket.ProjectId.Value}/backlog";

            foreach (var userId in recipientUserIds)
            {
                // Anti-duplication : vérifier si une notification du même type pour ce ticket
                // a déjà été envoyée aujourd'hui à cet utilisateur
                var todayStart = DateTime.UtcNow.Date;
                var alreadySent = await _context.Notifications
                    .AsNoTracking()
                    .AnyAsync(n => n.UserId == userId
                        && n.Type == notifType
                        && n.TargetUrl == targetUrl
                        && n.CreatedAt >= todayStart);

                if (alreadySent) continue;

                try
                {
                    await _notificationService.SendNotificationAsync(
                        userId,
                        title,
                        message,
                        targetUrl,
                        notifType);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex,
                        "Échec de l'envoi de notification d'échéance ({NotifType}) pour le ticket {TicketId} à {UserId}",
                        notifType, ticket.Id, userId);
                }
            }
        }
    }
}
