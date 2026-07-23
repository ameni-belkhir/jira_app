using System;
using System.Collections.Generic;

namespace Application.DTO
{
    public class ConversationDto
    {
        public int Id { get; set; }
        public string Titre { get; set; } = string.Empty;
        public DateTime DateCreation { get; set; }
        public int? TicketId { get; set; }
        public ICollection<int> MessageIds { get; set; } = new List<int>();
    }
}
