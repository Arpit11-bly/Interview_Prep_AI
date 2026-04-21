import axios from "axios";
import { BASE_URL } from "./apiPaths";
// import { config } from "node:process";
// import { access } from "node:fs";
// import { error } from "node:console";

const axiosInstance = axios.create({
    baseURL: BASE_URL,
    timeout: 80000,
    headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
    },
    
});

//ReQUESt interceptor

axiosInstance.interceptors.request.use(
    (config) => {
        const accessToken= localStorage.getItem("token");
        if(accessToken){
            config.headers.Authorization = `Bearer ${accessToken}`;
        }
        return config;
    },
        (error) => {
            return Promise.reject(error);
        }
);

//RESponse Interceptor

axiosInstance.interceptors.response.use(
    (response) =>{
        return response;
    },
    (error) =>{
        //Handle common errors globally

        if(error.response){
            if(error.response.status ===401){
                const accessToken = localStorage.getItem("token");

                if (accessToken) {
                    localStorage.removeItem("token");

                    if (window.location.pathname !== "/") {
                        window.location.href = "/";
                    }
                }

               }
               else if (error.response.status ===500){
                console.error(" Server error. Please try again later.");

               }
            }else if(error.code === "ECONNABORTED"){
                console.log("Request timeout. Plese try again ");
            }
               return Promise.reject(error);
        }
    
);
export default axiosInstance;
