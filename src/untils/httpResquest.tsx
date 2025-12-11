import axios from 'axios';

const httpRequest = axios.create({
    baseURL: 'https://teacher-toolbox-47893-default-rtdb.firebaseio.com',
});

export const get = async (path: string, options = {}) => {
    const response = await httpRequest.get(path, options);
    return response.data;
};

export default httpRequest;
