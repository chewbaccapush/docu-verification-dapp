import {Project} from "@prisma/client";
import {NextApiRequest, NextApiResponse} from "next";
import {createProject} from "@/lib/ProjectService";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const {method} = req;

    switch (method) {
        case "POST":
            console.log("here in post")
            const project: Project = await createProject(req.body);
            res.status(201).json(project);
            break;

        default:
            res.status(405).end(`Method ${method} Not Allowed`);
    }
}








