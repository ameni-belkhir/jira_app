using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace Application.DTO
{
    public class UpdateUserRoleDto
    {
        [Range(1, int.MaxValue)]
        public int RoleId { get; set; }

        // Décisions optionnelles par projet : aligner ou non le RoleInProject
        // sur le nouveau rôle global. Absent/null => aucun changement des rôles projet.
        public List<ProjectRoleDecisionDto>? ProjectRoleDecisions { get; set; }
    }
}
