using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Application.DTO;
using Application.Interfaces;
using Domain.Entity;
using Domain.Interfaces;

namespace Application.Services
{
    public class TicketService : ITicketService
    {
        private readonly ITicketRepository _ticketRepository;
        private readonly IUserRepository _userRepository;

        public TicketService(ITicketRepository ticketRepository, IUserRepository userRepository)
        {
            _ticketRepository = ticketRepository;
            _userRepository = userRepository;
        }

        public async Task<TicketDto?> GetByIdAsync(int id)
        {
            var ticket = await _ticketRepository.GetByIdAsync(id);
            if (ticket == null) return null;
            return MapToDto(ticket);
        }

        public async Task<IEnumerable<TicketDto>> GetAllAsync()
        {
            var tickets = await _ticketRepository.GetAllAsync();
            return tickets.Select(MapToDto);
        }

        public async Task<IEnumerable<TicketDto>> GetByProjectIdAsync(int projectId)
        {
            var tickets = await _ticketRepository.GetByProjectIdAsync(projectId);
            return tickets.Select(MapToDto);
        }

        public async Task<TicketDto> CreateAsync(TicketDto dto)
        {
            // Validate creator exists to avoid DB foreign-key errors
            var creator = await _userRepository.GetByIdAsync(dto.CreatorId);
            if (creator == null) throw new InvalidOperationException("Creator not found");

            if (dto.AssigneeId.HasValue)
            {
                var assignee = await _userRepository.GetByIdAsync(dto.AssigneeId.Value);
                if (assignee == null) throw new InvalidOperationException("Assignee not found");
            }

            var ticket = new Ticket
            {
                Titre = dto.Titre,
                Description = dto.Description,
                CreatorId = dto.CreatorId,
                AssigneeId = dto.AssigneeId,
                ProjectId = dto.ProjectId,
                Status = Enum.TryParse<Status>(dto.Status, out var s) ? s : Status.A_FAIRE,
                Priority = Enum.TryParse<Priority>(dto.Priority, out var p) ? p : Priority.MOYENNE,
                Color = string.IsNullOrEmpty(dto.Color) ? "#ffffff" : dto.Color
            };

            await _ticketRepository.AddAsync(ticket);
            await _ticketRepository.SaveChangesAsync();
            dto.Id = ticket.Id;
            return dto;
        }

        public async Task<bool> UpdateAsync(TicketDto dto)
        {
            var ticket = await _ticketRepository.GetByIdAsync(dto.Id);
            if (ticket == null) return false;
            ticket.Titre = dto.Titre;
            ticket.Description = dto.Description;
            // Validate assignee if provided
            if (dto.AssigneeId.HasValue)
            {
                var assignee = await _userRepository.GetByIdAsync(dto.AssigneeId.Value);
                if (assignee == null) throw new InvalidOperationException("Assignee not found");
            }
            ticket.AssigneeId = dto.AssigneeId;
            ticket.Status = Enum.TryParse<Status>(dto.Status, out var s) ? s : ticket.Status;
            ticket.Priority = Enum.TryParse<Priority>(dto.Priority, out var p) ? p : ticket.Priority;
            ticket.Color = string.IsNullOrEmpty(dto.Color) ? ticket.Color : dto.Color;
            _ticketRepository.Update(ticket);
            return await _ticketRepository.SaveChangesAsync();
        }

        public async Task<bool> DeleteAsync(int id)
        {
            var ticket = await _ticketRepository.GetByIdAsync(id);
            if (ticket == null) return false;
            _ticketRepository.Delete(ticket);
            return await _ticketRepository.SaveChangesAsync();
        }

        private static TicketDto MapToDto(Ticket ticket) => new TicketDto
        {
            Id = ticket.Id,
            Titre = ticket.Titre,
            Description = ticket.Description,
            CreatorId = ticket.CreatorId,
            AssigneeId = ticket.AssigneeId,
            ProjectId = ticket.ProjectId,
            Status = ticket.Status.ToString(),
            Priority = ticket.Priority.ToString(),
            DateCreation = ticket.DateCreation,
            DateResolution = ticket.DateResolution
            ,
            Color = ticket.Color ?? "#ffffff"
        };
    }
}
