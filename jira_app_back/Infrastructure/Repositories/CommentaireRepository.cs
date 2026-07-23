using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Domain.Entity;
using Domain.Interfaces;
using Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Repositories
{
    public class CommentaireRepository : ICommentaireRepository
    {
        private readonly ApplicationDbContext _context;

        public CommentaireRepository(ApplicationDbContext context)
        {
            _context = context;
        }

        public async Task AddAsync(Commentaire commentaire)
        {
            await _context.Commentaires.AddAsync(commentaire);
        }

        public void Delete(Commentaire commentaire)
        {
            _context.Commentaires.Remove(commentaire);
        }

        public async Task<Commentaire?> GetByIdAsync(int id)
        {
            return await _context.Commentaires.FindAsync(id);
        }

        public async Task<IEnumerable<Commentaire>> GetByTicketIdAsync(int ticketId)
        {
            return await _context.Commentaires
                .Where(c => c.TicketId == ticketId)
                .ToListAsync();
        }

        public void Update(Commentaire commentaire)
        {
            _context.Commentaires.Update(commentaire);
        }

        public async Task<bool> SaveChangesAsync()
        {
            return await _context.SaveChangesAsync() > 0;
        }
    }
}
