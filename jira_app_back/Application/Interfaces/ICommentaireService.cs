using System.Collections.Generic;
using System.Threading.Tasks;
using Application.DTO;

namespace Application.Interfaces
{
    public interface ICommentaireService
    {
        Task<CommentaireDto?> GetByIdAsync(int id);
        Task<IEnumerable<CommentaireDto>> GetByTicketIdAsync(int ticketId);
        Task<CommentaireDto> CreateAsync(CommentaireDto dto);
        Task<bool> UpdateAsync(CommentaireDto dto);
        Task<bool> DeleteAsync(int id);
    }
}
