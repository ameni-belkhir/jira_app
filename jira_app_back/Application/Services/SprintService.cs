using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Application.DTO;
using Application.Interfaces;
using Domain.Entity;
using Domain.Interfaces;

namespace Application.Services
{
    public class SprintService : ISprintService
    {
        private readonly ISprintRepository _sprintRepository;
        private readonly ITicketRepository _ticketRepository;

        public SprintService(ISprintRepository sprintRepository, ITicketRepository ticketRepository)
        {
            _sprintRepository = sprintRepository;
            _ticketRepository = ticketRepository;
        }

        public async Task<SprintDto> CreateAsync(CreateSprintDto dto)
        {
            ValidateDateRange(dto.StartDate, dto.EndDate);

            var sprint = new Sprint
            {
                Name = dto.Name,
                Goal = dto.Goal,
                ProjectId = dto.ProjectId,
                StartDate = dto.StartDate,
                EndDate = dto.EndDate
            };
            await _sprintRepository.AddAsync(sprint);
            await _sprintRepository.SaveChangesAsync();
            return MapToDto(sprint);
        }

        public async Task<bool> DeleteAsync(int id)
        {
            var sprint = await _sprintRepository.GetByIdAsync(id);
            if (sprint == null) return false;
            _sprintRepository.Delete(sprint);
            return await _sprintRepository.SaveChangesAsync();
        }

        public async Task<IEnumerable<SprintDto>> GetByProjectIdAsync(int projectId)
        {
            var sprints = await _sprintRepository.GetByProjectIdAsync(projectId);
            return sprints.Select(s => MapToDto(s));
        }

        public async Task<ProjectBacklogDto> GetProjectBacklogAsync(int projectId, int? userId = null, string? role = null)
        {
            var sprints = await _sprintRepository.GetByProjectIdAsync(projectId);
            var sprintDtos = sprints.Select(s => MapToDto(s, userId, role)).ToList();

            var tickets = await _ticketRepository.GetByProjectIdAsync(projectId);
            var isDeveloper = role == "Developer";
            var backlogTickets = tickets
                .Where(t => t.SprintId == null && t.ParentTicketId == null)
                .Where(t => !isDeveloper || t.AssigneeId == userId)
                .Select(t => MapTicketDto(t, userId, role))
                .ToList();

            return new ProjectBacklogDto
            {
                Sprints = sprintDtos,
                BacklogTickets = backlogTickets
            };
        }

        public async Task<IEnumerable<SprintTicketDto>> GetTicketsBySprintAsync(int sprintId, int? userId = null, string? role = null)
        {
            var tickets = await _ticketRepository.GetBySprintIdAsync(sprintId);
            var isDeveloper = role == "Developer";
            // Seuls les tickets racines sont renvoyés : les sous-tickets sont imbriqués
            // (SubTickets) dans leur parent, et héritent du SprintId du parent.
            return tickets
                .Where(t => t.ParentTicketId == null)
                .Where(t => !isDeveloper || t.AssigneeId == userId)
                .Select(t => MapSprintTicketDto(t, userId, role));
        }

        private static bool IsTicketVisible(Ticket t, int? userId, string? role)
            => role != "Developer" || t.AssigneeId == userId;

        private static SprintTicketDto MapSprintTicketDto(Ticket t, int? userId = null, string? role = null) => new SprintTicketDto
        {
            Id = t.Id,
            Title = t.Titre,
            Description = t.Description,
            Priority = t.Priority.ToString(),
            Status = t.Status.ToString(),
            AssignedTo = t.Assignee != null ? $"{t.Assignee.Prenom} {t.Assignee.Nom}" : null,
            AssignedToAvatar = t.Assignee?.ProfileImageUrl,
            Color = t.Color ?? "#ffffff",
            HasSubTickets = t.SubTickets != null && t.SubTickets.Any(),
            ParentTicketId = t.ParentTicketId,
            SubTickets = (t.SubTickets ?? new List<Ticket>())
                .Where(st => IsTicketVisible(st, userId, role))
                .Select(st => MapSprintTicketDto(st, userId, role))
                .ToList()
        };

        public async Task<bool> MoveTicketToSprintAsync(int ticketId, int? sprintId)
        {
            var ticket = await _ticketRepository.GetByIdAsync(ticketId);
            if (ticket == null) return false;
            if (sprintId != null)
            {
                var sprint = await _sprintRepository.GetByIdAsync(sprintId.Value);
                if (sprint == null) return false;
                ticket.SprintId = sprint.Id;
            }
            else
            {
                ticket.SprintId = null;
            }
            _ticketRepository.Update(ticket);
            return await _ticketRepository.SaveChangesAsync();
        }

        public async Task<bool> UpdateAsync(UpdateSprintDto dto)
        {
            var sprint = await _sprintRepository.GetByIdAsync(dto.Id);
            if (sprint == null) return false;
            if (!string.IsNullOrEmpty(dto.Name)) sprint.Name = dto.Name;
            sprint.Goal = dto.Goal ?? sprint.Goal;
            if (!string.IsNullOrEmpty(dto.Status) && System.Enum.TryParse<SprintStatus>(dto.Status, out var st)) sprint.Status = st;
            sprint.StartDate = dto.StartDate ?? sprint.StartDate;
            sprint.EndDate = dto.EndDate ?? sprint.EndDate;
            ValidateDateRange(sprint.StartDate, sprint.EndDate);
            _sprintRepository.Update(sprint);
            return await _sprintRepository.SaveChangesAsync();
        }

        private static SprintDto MapToDto(Sprint s, int? userId = null, string? role = null) => new SprintDto
        {
            Id = s.Id,
            Name = s.Name,
            Goal = s.Goal,
            StartDate = s.StartDate,
            EndDate = s.EndDate,
            Status = s.Status.ToString(),
            ProjectId = s.ProjectId,
            Tickets = (s.Tickets ?? new List<Ticket>())
                .Where(t => t.ParentTicketId == null)
                .Where(t => IsTicketVisible(t, userId, role))
                .Select(t => MapTicketDto(t, userId, role))
                .ToList()
        };

        private static TicketDto MapTicketDto(Ticket t, int? userId = null, string? role = null) => new TicketDto
        {
            Id = t.Id,
            Titre = t.Titre,
            Description = t.Description,
            CreatorId = t.CreatorId,
            AssigneeId = t.AssigneeId,
            AssignedTo = t.Assignee != null ? $"{t.Assignee.Prenom} {t.Assignee.Nom}" : null,
            AssignedToAvatar = t.Assignee?.ProfileImageUrl,
            ProjectId = t.ProjectId,
            Status = t.Status.ToString(),
            Priority = t.Priority.ToString(),
            DateCreation = t.DateCreation,
            DateResolution = t.DateResolution,
            Color = t.Color ?? "#ffffff",
            HasSubTickets = t.SubTickets != null && t.SubTickets.Any(),
            ParentTicketId = t.ParentTicketId,
            SubTickets = (t.SubTickets ?? new List<Ticket>())
                .Where(st => IsTicketVisible(st, userId, role))
                .Select(st => MapTicketDto(st, userId, role))
                .ToList()
        };

        private static void ValidateDateRange(DateTime? startDate, DateTime? endDate)
        {
            if (startDate.HasValue && endDate.HasValue && endDate.Value <= startDate.Value)
                throw new ArgumentException("La date de fin doit être postérieure à la date de début.");
        }
    }
}
