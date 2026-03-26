'use client';
import { useSession } from "next-auth/react";

import { useState, useRef, useEffect } from "react";
import jsPDF from "jspdf";
import { saveToLocalStorage } from "../utils/localStorageHelper";

import PersonalInfo from "../components/ui/leftSide/PersonalInfo.create-resume";
import SkillLeft from "../components/ui/leftSide/Skills.left";
import EducationLeft from "../components/ui/leftSide/Education.Left";
import ExperienceLeft from "../components/ui/leftSide/Experience.left";
import ProjectsLeft from "../components/ui/leftSide/Project.Left";
import AcheivementLeft from "../components/ui/leftSide/Acheivements.Left";
import LinkedInUpload from "../components/ui/leftSide/LinkedInUpload";

import PersonalInfoRight from "../components/ui/rightSide/PersonalInfo.Right";
import SkillRight from "../components/ui/rightSide/SkillRight";
import EducationRight from "../components/ui/rightSide/EducationRight";
import ExperienceRight from "../components/ui/rightSide/Experience.Right";
import ProjectsRight from "../components/ui/rightSide/Project.Right";
import AchievementsRight from "../components/ui/rightSide/Acheivements.Right";

export default function CreateResume() {
  const { data: session, status } = useSession();
const loading = status === "loading";

 const [info, setInfo] = useState({
  name: "", location: "", email: "", github: "", linkedin: "", twitter: "", summary: ""
});

  const [skills, setSkills] = useState([{ category: '', items: '' }]);
  const [education, setEducation] = useState([{ institute: '', degree: '', duration: '', score: '' }]);
  const [experience, setExperience] = useState([{ role: '', organization: '', location: '', duration: '', points: [''] }]);
  const [projects, setProjects] = useState([{ title: '', description: '', points: [''], github: '' }]);
  const [achievement, setAchievement] = useState([{ items: '' }]);

  const resumeRef = useRef(null);

  const handleDownloadPDF = async () => {
    if (!resumeRef.current) return;

    const pdf = new jsPDF("p", "pt", "a4");

    await pdf.html(resumeRef.current, {
      callback: function (doc) {
        doc.save("resume.pdf");
      },
      margin: [20, 20, 20, 20],
      autoPaging: "text",
      html2canvas: {
        scale: 2,
        useCORS: true,
      },
      x: 0,
      y: 0,
    });
  };

  useEffect(() => {
    saveToLocalStorage("resumeData", {
      info,
      skills,
      education,
      experience,
      projects,
      achievement,
    });
  }, [info, skills, education, experience, projects, achievement]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.downloadResume = handleDownloadPDF;
    }
    return () => {
      if (typeof window !== 'undefined') {
        delete window.downloadResume;
      }
    };
  }, []);

  const handleLinkedInDataParsed = (parsedData: any) => {
    if (parsedData.info) {
      setInfo(parsedData.info);
    }
    if (parsedData.skills && parsedData.skills.length > 0) {
      setSkills(parsedData.skills);
    }
    if (parsedData.education && parsedData.education.length > 0) {
      setEducation(parsedData.education);
    }
    if (parsedData.experience && parsedData.experience.length > 0) {
      setExperience(parsedData.experience);
    }
    if (parsedData.projects && parsedData.projects.length > 0) {
      setProjects(parsedData.projects);
    }
  };

 const bypassAuth = false; 

 return (
  <div className="relative w-screen h-screen overflow-y-auto">
    {(!bypassAuth && !session && !loading) && (
     <div className="absolute z-50 inset-0 flex items-center justify-center bg-black/30 backdrop-blur-sm">
  <div className="w-[90%] max-w-md rounded-xl bg-white/20 backdrop-filter backdrop-blur-lg border border-white/30 p-8 shadow-2xl text-center">
    <h2 className="text-2xl font-semibold text-black/80 drop-shadow mb-4"
     style={{
     fontFamily: "var(--font-quicksand)" 
  }}
    >
      Please Sign In to Continue</h2>
    <a href="/signin">
      <button className="mt-2 mx-auto flex items-center justify-center text-black  px-6 py-2 rounded-sm bg-green-600/70 title-font hover:bg-green-600/90 transition-all duration-500 border-1 border-black/20 shadow gap-[0.5] cursor-pointer">
        <img src="/log-in.png" alt="Sign In Icon" className="w-4 h-4" />
        Sign In
      </button>
    </a>
  </div>
</div>

    )}

    <div
      className={`absolute inset-0 bg-cover bg-center transition-all duration-300 ${
        !bypassAuth && !session && !loading ? 'opacity-40 blur-sm' : 'opacity-100'
      }`}
      style={{ backgroundImage: "url('create-resume.png')" }}
    />

    <div className="relative z-10 flex flex-col md:flex-row w-full gap-3 p-3 pt-6 mt-13 md:mt-20">
      <div className="w-full md:w-1/2 max-h-[83vh] overflow-y-auto p-4 border border-gray-400 shadow rounded-lg bg-white/90 scrollbar-hide">
        <LinkedInUpload onDataParsed={handleLinkedInDataParsed} />
        <PersonalInfo info={info} setInfo={setInfo} />
        <SkillLeft skills={skills} setSkills={setSkills} />
        <EducationLeft education={education} setEducation={setEducation} />
        <ExperienceLeft experience={experience} setExperience={setExperience} />
        <ProjectsLeft projects={projects} setProjects={setProjects} />
        <AcheivementLeft achievement={achievement} setAchievement={setAchievement} />
      </div>

      <div className="w-full md:w-1/2 max-h-[83vh] overflow-y-auto border shadow rounded-lg bg-white/90 scrollbar-hide">
        <div
          ref={resumeRef}
          id="right-resume-preview"
          className="min-h-full"
          data-html2canvas-ignore="false"
        >
          <PersonalInfoRight info={info} />
          <SkillRight skills={skills} />
          <EducationRight education={education} />
          <ExperienceRight experience={experience} />
          <ProjectsRight projects={projects} />
          <AchievementsRight achievement={achievement} />
        </div>
      </div>
    </div>
  </div>
);


}
