using System;
using System.Collections.Generic;

namespace Domain.Entity
{
    public class Conversation
    {
        public int Id { get; set; }
        public string Titre { get; set; } = string.Empty;
        public DateTime DateCreation { get; set; } = DateTime.UtcNow;

        // Relation optionnelle vers un ticket
        public int? TicketId { get; set; }
        public Ticket? Ticket { get; set; }

        // Messages de la conversation
        public ICollection<Message> Messages { get; set; } = new List<Message>();
    }
}
