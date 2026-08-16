using System.Collections.Generic;
using System.Threading.Tasks;
using Application.DTO;

namespace Application.Interfaces
{
    public interface ISprintService
    {
        Task<IEnumerable<SprintDto>> GetByProjectIdAsync(int projectId);
        Task<ProjectBacklogDto> GetProjectBacklogAsync(int projectId, int? userId = null, string? role = null);
        Task<IEnumerable<SprintTicketDto>> GetTicketsBySprintAsync(int sprintId, int? userId = null, string? role = null);
        Task<SprintDto> CreateAsync(CreateSprintDto dto);
        Task<bool> UpdateAsync(UpdateSprintDto dto);
        Task<bool> DeleteAsync(int id);
        Task<bool> MoveTicketToSprintAsync(int ticketId, int? sprintId);
    }
}
