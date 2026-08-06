using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Application.DTO;
using Application.Interfaces;
using Domain.Entity;
using Domain.Interfaces;

namespace Application.Services
{
    public class ProjectService : IProjectService
    {
        private readonly IProjectRepository _projectRepository;
        private readonly IUserRepository _userRepository;

        public ProjectService(IProjectRepository projectRepository, IUserRepository userRepository)
        {
            _projectRepository = projectRepository;
            _userRepository = userRepository;
        }

        public async Task<ProjectDto?> GetByIdAsync(int id)
        {
            var project = await _projectRepository.GetByIdAsync(id);
            if (project == null) return null;
            return MapToDto(project);
        }

        public async Task<IEnumerable<ProjectDto>> GetAllAsync()
        {
            var projects = await _projectRepository.GetAllAsync();
            return projects.Select(MapToDto);
        }

        /// <summary>
        /// Retourne les projets visibles par un utilisateur selon son rôle global :
        /// - "Admin" : tous les projets.
        /// - "ScrumMaster" : projets créés par lui OU projets dont il est membre.
        /// - autres : uniquement les projets dont il est membre.
        /// </summary>
        public async Task<IEnumerable<ProjectDto>> GetProjectsForUserAsync(int userId, string userRole)
        {
            var allProjects = await _projectRepository.GetAllAsync();

            if (string.Equals(userRole, "Admin", StringComparison.OrdinalIgnoreCase))
            {
                return allProjects.Select(MapToDto);
            }

            if (string.Equals(userRole, "ScrumMaster", StringComparison.OrdinalIgnoreCase))
            {
                return allProjects
                    .Where(p => p.CreatedById == userId ||
                                p.Members.Any(m => m.UserId == userId))
                    .Select(MapToDto);
            }

            return allProjects
                .Where(p => p.Members.Any(m => m.UserId == userId))
                .Select(MapToDto);
        }

        public async Task<ProjectDto> CreateAsync(ProjectDto dto)
        {
            var project = new Project
            {
                Nom = dto.Nom,
                Responsable = dto.Responsable,
                Description = dto.Description,
                CreatedById = dto.CreatedById
            };

            // Le créateur est automatiquement ScrumMaster
            project.Members.Add(new ProjectMember
            {
                UserId = dto.CreatedById,
                RoleInProject = "ScrumMaster",
                JoinedAt = DateTime.UtcNow
            });

            // Ajout des Scrum Masters sélectionnés
            foreach (var scrumMasterId in dto.ScrumMasterIds.Distinct().Where(id => id != dto.CreatedById))
            {
                project.Members.Add(new ProjectMember
                {
                    UserId = scrumMasterId,
                    RoleInProject = "ScrumMaster",
                    JoinedAt = DateTime.UtcNow
                });
            }

            await _projectRepository.AddAsync(project);
            await _projectRepository.SaveChangesAsync();
            dto.Id = project.Id;
            return MapToDto(project);
        }

        public async Task<bool> UpdateAsync(ProjectDto dto)
        {
            var project = await _projectRepository.GetByIdAsync(dto.Id);
            if (project == null) return false;
            project.Nom = dto.Nom;
            project.Description = dto.Description;
            project.Responsable = dto.Responsable;

            _projectRepository.Update(project);
            return await _projectRepository.SaveChangesAsync();
        }

        public async Task<bool> DeleteAsync(int id)
        {
            var project = await _projectRepository.GetByIdAsync(id);
            if (project == null) return false;
            _projectRepository.Delete(project);
            return await _projectRepository.SaveChangesAsync();
        }

        private static ProjectDto MapToDto(Project project) => new ProjectDto
        {
            Id = project.Id,
            Nom = project.Nom,
            Responsable = project.Responsable,
            Description = project.Description,
            CreatedById = project.CreatedById,
            Members = project.Members?.Select(m => new ProjectMemberSummaryDto
            {
                UserId = m.UserId,
                Nom = m.User?.Nom ?? "",
                Prenom = m.User?.Prenom ?? "",
                RoleInProject = m.RoleInProject
            }).ToList() ?? new List<ProjectMemberSummaryDto>(),
            ScrumMasterIds = project.Members?
                .Where(m => m.RoleInProject == "ScrumMaster")
                .Select(m => m.UserId)
                .ToList() ?? new List<int>()
        };
    }
}
