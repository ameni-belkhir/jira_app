using System.Collections.Generic;
using System.Threading.Tasks;
using Application.DTO;

namespace Application.Interfaces
{
    public interface ITicketService
    {
        Task<TicketDto?> GetByIdAsync(int id);
        Task<IEnumerable<TicketDto>> GetAllAsync();
        Task<IEnumerable<TicketDto>> GetByProjectIdAsync(int projectId);
        Task<TicketDto> CreateAsync(TicketDto dto);
        Task<bool> UpdateAsync(TicketDto dto);
        Task<bool> DeleteAsync(int id);
    }
}
