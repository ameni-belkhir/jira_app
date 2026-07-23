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

        public async Task<ProjectDto> CreateAsync(ProjectDto dto)
        {
            var project = new Project
            {
                Nom = dto.Nom,
                Responsable = dto.Responsable,
                Description = dto.Description
            };

            // Optionally attach members by ids
            foreach (var memberId in dto.MemberIds)
            {
                var user = await _userRepository.GetByIdAsync(memberId);
                if (user != null) project.Members.Add(user);
            }

            await _projectRepository.AddAsync(project);
            await _projectRepository.SaveChangesAsync();
            dto.Id = project.Id;
            return dto;
        }

        public async Task<bool> UpdateAsync(ProjectDto dto)
        {
            var project = await _projectRepository.GetByIdAsync(dto.Id);
            if (project == null) return false;
            project.Nom = dto.Nom;
            project.Description = dto.Description;
            project.Responsable = dto.Responsable;

            // Members synchronization omitted for brevity

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
            MemberIds = project.Members.Select(m => m.Id).ToList()
        };
    }
}
