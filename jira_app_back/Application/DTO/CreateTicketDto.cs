using System.ComponentModel.DataAnnotations;

namespace Application.DTO
{
    public class CreateTicketDto
    {
        [Required]
        public string Titre { get; set; } = string.Empty;

        public string Description { get; set; } = string.Empty;

        [Required]
        public int CreatorId { get; set; }

        public int? AssigneeId { get; set; }

        public int? ProjectId { get; set; }

        public int? SprintId { get; set; }

        public string? Status { get; set; }

        public string? Priority { get; set; }

        // Couleur optionnelle (hex), ex: "#ff0000"
        public string? Color { get; set; } = "#ffffff";

        // Date d'échéance optionnelle
        public DateTime? DateEcheance { get; set; }

        // Sous-tâche : ticket parent optionnel
        public int? ParentTicketId { get; set; }
    }
}
