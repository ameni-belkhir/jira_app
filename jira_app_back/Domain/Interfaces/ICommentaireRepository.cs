using System.Collections.Generic;
using System.Threading.Tasks;
using Domain.Entity;

namespace Domain.Interfaces
{
    public interface ICommentaireRepository
    {
        Task<Commentaire?> GetByIdAsync(int id);
        Task<IEnumerable<Commentaire>> GetByTicketIdAsync(int ticketId);
        Task AddAsync(Commentaire commentaire);
        void Update(Commentaire commentaire);
        void Delete(Commentaire commentaire);
        Task<bool> SaveChangesAsync();
    }
}
