/*===== MENU SHOW =====*/ 
const showMenu = (toggleId, navId) =>{
    const toggle = document.getElementById(toggleId),
    nav = document.getElementById(navId)

    if(toggle && nav){
        toggle.addEventListener('click', ()=>{
            nav.classList.toggle('show')
        })
    }
}
showMenu('nav-toggle','nav-menu')

/*==================== REMOVE MENU MOBILE ====================*/
const navLink = document.querySelectorAll('.nav__link')

function linkAction(){
    const navMenu = document.getElementById('nav-menu')
    // When we click on each nav__link, we remove the show-menu class
    navMenu.classList.remove('show')
}
navLink.forEach(n => n.addEventListener('click', linkAction))

/*==================== SCROLL SECTIONS ACTIVE LINK ====================*/
const sections = document.querySelectorAll('section[id]')

const scrollActive = () =>{
    const scrollDown = window.scrollY

  sections.forEach(current =>{
        const sectionHeight = current.offsetHeight,
              sectionTop = current.offsetTop - 58,
              sectionId = current.getAttribute('id'),
              sectionsClass = document.querySelector('.nav__menu a[href*=' + sectionId + ']')
        
        if(scrollDown > sectionTop && scrollDown <= sectionTop + sectionHeight){
            sectionsClass.classList.add('active-link')
        }else{
            sectionsClass.classList.remove('active-link')
        }                                                    
    })
}
window.addEventListener('scroll', scrollActive)

/*===== SCROLL REVEAL ANIMATION =====*/
const sr = ScrollReveal({
    origin: 'top',
    distance: '60px',
    duration: 2000,
    delay: 200,
//     reset: true
});

sr.reveal('.home__data, .about__img, .skills__subtitle, .skills__text',{}); 
sr.reveal('.home__img, .about__subtitle, .about__text, .skills__img',{delay: 400}); 
sr.reveal('.home__social-icon',{ interval: 200}); 
sr.reveal('.skills__data, .work__img, .contact__input',{interval: 200}); 
// Toggle Navbar Menu in Mobile View
const navMenu = document.getElementById('nav-menu');
const navToggle = document.getElementById('nav-toggle');

navToggle.addEventListener('click', () => {
  navMenu.classList.toggle('show-menu');
});

// Function to handle logout (example placeholder)
function logout() {
  alert('Logged out');
}

document.addEventListener("DOMContentLoaded", function () {
    const requestBtn = document.getElementById("requestWaterBtn");
    const formContainer = document.getElementById("extraWaterFormContainer");
    const closeFormBtn = document.getElementById("closeForm");
    const extraWaterForm = document.getElementById("extraWaterForm");

    // Show form when clicking the "Request Extra Water" button
    requestBtn.addEventListener("click", () => {
        formContainer.classList.remove("hidden");
    });

    // Hide form when clicking the "Cancel" button
    closeFormBtn.addEventListener("click", () => {
        formContainer.classList.add("hidden");
    });

    // Handle form submission
    extraWaterForm.addEventListener("submit", async (e) => {
        e.preventDefault(); // Prevent default form submission
        const liters = document.getElementById("liters").value;

        try {
            const response = await fetch("/request-extra-water", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ liters }),
            });

            if (response.ok) {
                alert("The request for extra water is submitted successfully!");
                formContainer.classList.add("hidden"); // Close form
                extraWaterForm.reset(); // Clear input field
            } else {
                alert("Failed to submit request. Try again.");
            }
        } catch (error) {
            console.error("Error:", error);
            alert("Something went wrong. Try again later.");
        }
    });
});

