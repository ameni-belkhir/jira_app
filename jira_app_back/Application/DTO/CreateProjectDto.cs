using System.ComponentModel.DataAnnotations;
using System.Collections.Generic;

namespace Application.DTO
{
    public class CreateProjectDto
    {
        [Required]
        public string Nom { get; set; } = string.Empty;

        public string Responsable { get; set; } = string.Empty;

        public string Description { get; set; } = string.Empty;

        /// <summary>
        /// Liste des IDs des Scrum Masters à assigner au projet dès sa création.
        /// Tous ces utilisateurs seront enregistrés dans ProjectMembers avec RoleInProject = "ScrumMaster".
        /// </summary>
        public List<int> ScrumMasterIds { get; set; } = new List<int>();

        /// <summary>
        /// ID de l'utilisateur créant le projet (peut être dérivé du JWT côté serveur).
        /// </summary>
        public int CreatedById { get; set; }
    }
}
