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
            return sprints.Select(MapToDto);
        }

        public async Task<ProjectBacklogDto> GetProjectBacklogAsync(int projectId)
        {
            var sprints = await _sprintRepository.GetByProjectIdAsync(projectId);
            var sprintDtos = sprints.Select(MapToDto).ToList();

            var backlogTickets = (await _ticketRepository.GetByProjectIdAsync(projectId))
                .Where(t => t.SprintId == null)
                .Select(t => new TicketDto
                {
                    Id = t.Id,
                    Titre = t.Titre,
                    Description = t.Description,
                    CreatorId = t.CreatorId,
                    AssigneeId = t.AssigneeId,
                    ProjectId = t.ProjectId,
                    Status = t.Status.ToString(),
                    Priority = t.Priority.ToString(),
                    DateCreation = t.DateCreation,
                    DateResolution = t.DateResolution
                }).ToList();

            return new ProjectBacklogDto
            {
                Sprints = sprintDtos,
                BacklogTickets = backlogTickets
            };
        }

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
            _sprintRepository.Update(sprint);
            return await _sprintRepository.SaveChangesAsync();
        }

        private static SprintDto MapToDto(Sprint s) => new SprintDto
        {
            Id = s.Id,
            Name = s.Name,
            Goal = s.Goal,
            StartDate = s.StartDate,
            EndDate = s.EndDate,
            Status = s.Status.ToString(),
            ProjectId = s.ProjectId,
            Tickets = s.Tickets?.Select(t => new TicketDto
            {
                Id = t.Id,
                Titre = t.Titre,
                Description = t.Description,
                CreatorId = t.CreatorId,
                AssigneeId = t.AssigneeId,
                ProjectId = t.ProjectId,
                Status = t.Status.ToString(),
                Priority = t.Priority.ToString(),
                DateCreation = t.DateCreation,
                DateResolution = t.DateResolution
            }).ToList() ?? new List<TicketDto>()
        };
    }
}
