using System;

namespace Domain.Entity
{
    public class Commentaire
    {
        public int Id { get; set; }
        public string Contenu { get; set; } = string.Empty;
        public DateTime DateCreation { get; set; } = DateTime.UtcNow;

        public int AuthorId { get; set; }
        public User? Author { get; set; }

        public int? TicketId { get; set; }
        public Ticket? Ticket { get; set; }
    }
}
