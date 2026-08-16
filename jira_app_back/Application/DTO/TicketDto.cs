using System;
using System.Collections.Generic;

namespace Application.DTO
{
    public class TicketDto
    {
        public int Id { get; set; }
        public string Titre { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public int CreatorId { get; set; }
        public int? AssigneeId { get; set; }
        public string? AssignedTo { get; set; }
        public string? AssignedToAvatar { get; set; }
        public int? ProjectId { get; set; }
        public int? SprintId { get; set; }
        public string Status { get; set; } = string.Empty;
        public string Priority { get; set; } = string.Empty;
        public DateTime DateCreation { get; set; }
        public DateTime? DateResolution { get; set; }
        public string Color { get; set; } = "#ffffff";
        public bool HasSubTickets { get; set; }

        // Hiérarchie : ticket parent (nullable si ticket racine) + sous-tickets
        public int? ParentTicketId { get; set; }
        public List<TicketDto> SubTickets { get; set; } = new();

        // Related collections
        public ICollection<int> CommentaireIds { get; set; } = new List<int>();
        public ICollection<int> ConversationIds { get; set; } = new List<int>();
    }
}
