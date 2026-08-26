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

                // NB : les durées ci-dessous sont calculées UNE seule fois, au moment de la
                // création de la notification ; le texte affiché reste figé à cette valeur
                // (aucun recalcul dynamique côté frontend).

                // A. Échéance proche : utcNow >= (due - 30min) && utcNow < due
                if (utcNow >= windowStart && utcNow < due)
                {
                    // La fenêtre étant [due-30min ; due[, le reste est toujours entre 1 et 30 min.
                    var minutesLeft = Math.Max(1, (int)Math.Ceiling((due - utcNow).TotalMinutes));
                    await SendDeadlineNotificationAsync(
                        ticket,
                        "deadline_approaching",
                        "Échéance proche",
                        $"Le ticket « {ticket.Titre} » arrive à échéance dans {minutesLeft} minute{(minutesLeft > 1 ? "s" : "")}.");
                }

                // B. Échéance dépassée : utcNow >= due
                if (utcNow >= due)
                {
                    var late = utcNow - due;
                    string overdueMessage;
                    if (late.TotalHours < 24)
                    {
                        // Ceiling pour ne jamais afficher "0h" (retard < 1h arrondi à 1h).
                        var hoursLate = Math.Max(1, (int)Math.Ceiling(late.TotalHours));
                        overdueMessage = $"Le ticket « {ticket.Titre} » a dépassé sa date d'échéance (en retard de {hoursLate}h).";
                    }
                    else
                    {
                        var daysLate = Math.Max(1, (int)Math.Floor(late.TotalDays));
                        overdueMessage = $"Le ticket « {ticket.Titre} » a dépassé sa date d'échéance (en retard de {daysLate} jour{(daysLate > 1 ? "s" : "")}).";
                    }

                    await SendDeadlineNotificationAsync(
                        ticket,
                        "deadline_passed",
                        "Échéance dépassée",
                        overdueMessage);
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

            // L'ID du ticket est encodé dans l'URL (query param) : la comparaison exacte de
            // TargetUrl dans le test anti-doublon ci-dessous rend la dédup PAR TICKET
            // (1 notif / destinataire / ticket / jour), tout en restant compatible avec la
            // route Angular existante /projects/:id/backlog (aucune route /tickets/{id}).
            var targetUrl = $"/projects/{ticket.ProjectId.Value}/backlog?ticket={ticket.Id}";

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
