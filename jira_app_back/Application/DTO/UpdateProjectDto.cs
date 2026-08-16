using System.ComponentModel.DataAnnotations;
using System.Collections.Generic;

namespace Application.DTO
{
    public class UpdateProjectDto
    {
        [Required]
        public int Id { get; set; }

        [Required]
        public string Nom { get; set; } = string.Empty;

        public string Responsable { get; set; } = string.Empty;

        public string Description { get; set; } = string.Empty;

        /// <summary>
        /// Liste complète des IDs des Scrum Masters du projet après édition.
        /// Synchronisation complète : les SM absents de cette liste sont retirés de ProjectMembers,
        /// les nouveaux sont ajoutés.
        /// </summary>
        public List<int> ScrumMasterIds { get; set; } = new List<int>();
    }
}
