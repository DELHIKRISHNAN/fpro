import { auth } from "./firebaseConfig.js";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";

// Register User
window.registerUser = async function() {
    const email = document.getElementById("register-email").value;
    const password = document.getElementById("register-password").value;

    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        alert("Registration Successful!");
        console.log(userCredential.user);
    } catch (error) {
        alert(error.message);
    }
};

// Login User
window.loginUser = async function() {
    const email = document.getElementById("login-email").value;
    const password = document.getElementById("login-password").value;

    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        alert("Login Successful!");
        console.log(userCredential.user);
        window.location.href = "user_dashboard.ejs"; // Redirect after login
    } catch (error) {
        alert(error.message);
    }
};
