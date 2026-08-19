using System;
using System.Collections.Generic;

namespace Domain.Entity
{
    public class Ticket
    {
        public int Id { get; set; }
        public string Titre { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;

        public Status Status { get; set; } = Status.A_FAIRE;
        public Priority Priority { get; set; } = Priority.MOYENNE;

        public DateTime DateCreation { get; set; } = DateTime.UtcNow;
        public DateTime? DateResolution { get; set; }
        public DateTime? DateEcheance { get; set; }

        // Affectation
        public int? AssigneeId { get; set; }
        public User? Assignee { get; set; }

        // Créateur du ticket
        public int CreatorId { get; set; }
        public User Creator { get; set; } = null!;

        // Projet
        public int? ProjectId { get; set; }
        public Project? Project { get; set; }

        // Sprint (nullable : ticket hors-sprint = backlog général)
        public int? SprintId { get; set; }
        public Sprint? Sprint { get; set; }

        // Commentaires
        public ICollection<Commentaire> Commentaires { get; set; } = new List<Commentaire>();

        // Conversations liées
        public ICollection<Conversation> Conversations { get; set; } = new List<Conversation>();

        // Couleur d'affichage du ticket (hex)
        public string? Color { get; set; } = "#ffffff";

        // Support des sous-tâches (self-referencing)
        public int? ParentTicketId { get; set; }
        public Ticket? ParentTicket { get; set; }
        public ICollection<Ticket> SubTickets { get; set; } = new List<Ticket>();
    }
}
