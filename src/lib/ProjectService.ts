import {prisma} from "@/utils/PrismaClient";
import {Project, User} from "@prisma/client";
import {Contract, ContractFactory} from "ethers";
import {ArtifactType, getContractArtifact} from "@/utils/BlockchainUtils";
import {provider} from "@/utils/EthereumClient";
import {ProjectState} from ".prisma/client";

import {findUserByAddress, findUserById} from "./UserService";
import {DocumentContractModel, MainDocumentType} from "../models/DocumentContractModel";
import {AddressZero} from "@ethersproject/constants";
import {getErrorReason} from "../utils/BlockchainUtils";
import {dateFromTimestamp} from "../utils/DateUtils";

/*const URL: string = process.env.BACKEND_URL;

async function getContract(contractAddress: string, signer: string): Promise<Contract> {
    if (isAuthorized(signer)) {
        try {
            return new Contract(address, getContractArtifact(ArtifactType.PROJECT_ARTIFACT).abi, await ethers.getSigner(signer));
        } catch (error: Error) {
            throw error;
        }
    } else {
        throw new Error("User not authorized");
    }
}*/

export const createProject = async (data: Project, walletAddress: string) => {
    try {
        const contractArtifact: any = getContractArtifact(ArtifactType.PROJECT_ARTIFACT);
        // Deploys a new Project smart contract on a blockchain
        const contractFactory: ContractFactory = new ContractFactory(contractArtifact.abi, contractArtifact.bytecode, await provider.getSigner(walletAddress));

        const contract: Contract = await contractFactory.deploy();
        await contract.deployed();
        console.log(`Project contract with address ${contract.address} deployed`);

        // Inserts Project and links it within User
        data.smartContractAddress = contract.address;
        data.createdAt = parseInt(await contract.dateCreated());
        let project: Project = await prisma.project.create({
            data: data,
        });

        await prisma.user.update({
            where: {walletAddress: walletAddress},
            data: {
                projectAddresses: {
                    push: contract.address,
                },
            },
        });

        return project;
    } catch (error: Error | any) {
        console.log(error.message);
        throw new Error("Something went wrong in ProjectService.ts");
    }
};

export const findBaseProjectById = async (id: string): Promise<Project> => {
    try {
        const baseProject = await prisma.project.findFirst({
            where: {
                id: id,
            },
        });

        if (baseProject) return baseProject!;

        throw new Error("Project not found");
    } catch (error: any) {
        throw error;
    }
};

export const findProjectById = async (id: string) => {
    try {
        // Queries DB
        const baseProject: Project | null = await prisma.project.findFirst({
            where: {
                id: id,
            },
            include: {
                investors: true,
            },
        });

        if (!baseProject) throw new Error("Project not found");

        // Queries blockchain
        const projectContract = new Contract(baseProject.smartContractAddress, getContractArtifact(ArtifactType.PROJECT_ARTIFACT).abi, provider);

        const projectManager: User | null = await findUserByAddress(await projectContract.projectManager());

        let assessmentProviders: User[] = [];
        for (const address of await projectContract.getAssessmentProvidersAddresses()) {
            let user: User | null = await findUserByAddress(address);
            if (user) assessmentProviders.push(user);
        }

        const numOfAssessmentProviders: number = parseInt(await projectContract.numOfAssessmentProviders());

        let administrativeAuthority: User | null = null;
        const administrativeAuthorityAddress: string = await projectContract.administrativeAuthority();
        if (administrativeAuthorityAddress != AddressZero) {
            administrativeAuthority = await findUserByAddress(administrativeAuthorityAddress);
            console.log(administrativeAuthority);
        }

        const DPP = await projectContract.DPP();
        const DPPUrl: string | null = DPP.id != "" ? DPP.id : null;
        const sentDPPs: DocumentContractModel[] = await getDocumentContractModels(await projectContract.getSentDPPsAddresses());
        const numOfSentDPPs: number = parseInt(await projectContract.getSentDPPsLength());
        const numOfAssessedDPPs: number = parseInt(await projectContract.numOfAssessedDPPs());

        const DGD = await projectContract.DGD();
        const DGDUrl: string | null = DGD.id != "" ? DGD.id : null;
        const sentDGDs: DocumentContractModel[] | null = await getDocumentContractModels(await projectContract.getSentDGDsAddresses());
        const numOfSentDGDs: number = parseInt(await projectContract.getSentDGDsLength());
        const numOfAssessedDGDs: number = parseInt(await projectContract.numOfAssessedDGDs());

        const isDPPPhaseFinalized = await projectContract.isDPPPhaseFinalized();

        return {
            baseProject: baseProject,
            projectManager: projectManager!,
            assessmentProviders: assessmentProviders,
            numOfAssessmentProviders: numOfAssessmentProviders,
            administrativeAuthority: administrativeAuthority,
            DPPUrl: DPPUrl,
            sentDPPs: sentDPPs,
            numOfSentDPPs: numOfSentDPPs,
            numOfAssessedDPPs: numOfAssessedDPPs,
            DGDUrl: DGDUrl,
            sentDGDs: sentDGDs,
            numOfSentDGDs: numOfSentDGDs,
            numOfAssessedDGDs: numOfAssessedDGDs,
            isDPPPhaseFinalized: isDPPPhaseFinalized
        };
    } catch (error: any) {
        throw new Error(error.message);
    }
};

export const getProjectsOfUserFromDatabase = async (userId: string): Promise<Project[]> => {
    try {
        const user = await findUserById(userId);
        return prisma.project.findMany({
            where: {
                smartContractAddress: {
                    in: user?.projectAddresses,
                },
            },
        });
    } catch (error: any) {
        throw new Error(error.message);
    }
};

export const getRecentProjects = async (projectIds: string[], userId: string) => {
    try {
        const user = await findUserById(userId);
        return await prisma.project.findMany({
            where: {
                AND: [{
                    id: {
                        in: projectIds,
                    }
                }, {
                    smartContractAddress: {
                        in: user?.projectAddresses,
                    }
                }
                ]

            },
        });
    } catch (error: any) {
        throw new Error(error.message);
    }
};

export const updateProject = async (project: Project) => {
    try {
        const {id, ...updatedProject} = project;
        return await prisma.project.update({
            where: {
                id: id,
            },
            data: updatedProject,
        });
    } catch (error: any) {
        throw new Error(error.message);
    }
};

export const getRecentProjectsByState = async (state: ProjectState, userId: string) => {
    try {
        const user = await findUserById(userId);
        let projects: Project[] = await prisma.project.findMany({
            where: {
                AND: [{
                    projectState: state
                }, {
                    smartContractAddress: {
                        in: user?.projectAddresses,
                    }
                }
                ]
            },
            orderBy: {
                createdAt: "desc",
            },
            take: 5,
        });
        if (projects.length == 0) return [];
        return projects;
    } catch (error: any) {
        throw new Error(error.message);
    }
};

export const addAssessmentProviders = async (projectAddress: string, signerAddress: string, assessmentProvidersAddresses: string[]) => {
    try {
        const projectContract = new Contract(projectAddress, getContractArtifact(ArtifactType.PROJECT_ARTIFACT).abi, await provider.getSigner(signerAddress));
        await projectContract.addAssessmentProviders(assessmentProvidersAddresses);
    } catch (error: any) {
        throw new Error(getErrorReason(error));
    }

    try {
        for (let assessmentProviderAddress of assessmentProvidersAddresses) {
            await prisma.user.update({
                where: {walletAddress: assessmentProviderAddress},
                data: {
                    projectAddresses: {
                        push: projectAddress,
                    },
                },
            });
        }
    } catch (error: any) {
        throw new Error(error.message);
    }
};

export const removeAssessmentProviders = async (projectAddress: string, signerAddress: string, assessmentProvidersAddresses: string[]) => {
  try {
    const projectContract = new Contract(projectAddress, getContractArtifact(ArtifactType.PROJECT_ARTIFACT).abi, await provider.getSigner(signerAddress));
    await projectContract.removeAssessmentProviders(assessmentProvidersAddresses);
  } catch (error: any) {
    throw new Error(getErrorReason(error));
  }

  try {
    for (let assessmentProviderAddress of assessmentProvidersAddresses) {
      await removeProjectFromUser(assessmentProviderAddress, projectAddress);
    }
  } catch (e: any) {
    throw e;
  }
};

export const setDPP = async (projectAddress: string, signerAddress: string, dppUrl: string, dppHash: string) => {
    try {
        const projectContract = new Contract(projectAddress, getContractArtifact(ArtifactType.PROJECT_ARTIFACT).abi, await provider.getSigner(signerAddress));

        const dpp = {
            id: dppUrl,
            owner: signerAddress,
            documentHash: dppHash,
        };

        await projectContract.setDPP(dpp);
    } catch (error: any) {
        throw new Error(getErrorReason(error));
    }
};

export const sendDPP = async (projectAddress: string, signerAddress: string, documentContractStructs: object[]) => {
    try {
        const projectContract = new Contract(projectAddress, getContractArtifact(ArtifactType.PROJECT_ARTIFACT).abi, await provider.getSigner(signerAddress));

        await projectContract.sendDPP(documentContractStructs);
    } catch (error: any) {
        throw new Error(getErrorReason(error));
    }
};

export const setDGD = async (projectAddress: string, signerAddress: string, dgdUrl: string, dgdHash: string) => {
    try {
        const projectContract = new Contract(projectAddress, getContractArtifact(ArtifactType.PROJECT_ARTIFACT).abi, await provider.getSigner(signerAddress));

        const dgd = {
            id: dgdUrl,
            owner: signerAddress,
            documentHash: dgdHash,
        };

        await projectContract.setDGD(dgd);
    } catch (error: any) {
        throw new Error(getErrorReason(error));
    }
};

export const sendDGD = async (projectAddress: string, signerAddress: string, documentContractStructs: object[]) => {
    try {
        const projectContract = new Contract(projectAddress, getContractArtifact(ArtifactType.PROJECT_ARTIFACT).abi, await provider.getSigner(signerAddress));

        await projectContract.sendDGD(documentContractStructs);
    } catch (error: any) {
        throw new Error(getErrorReason(error));
    }
};

export const changeAdministrativeAuthority = async (projectAddress: string, signerAddress: string, administrativeAuthorityAddress: string) => {
  try {
    const projectContract = new Contract(projectAddress, getContractArtifact(ArtifactType.PROJECT_ARTIFACT).abi, await provider.getSigner(signerAddress));
    const previousAdministrativeAuthority = await projectContract.administrativeAuthority();
    console.log(previousAdministrativeAuthority);
    if (previousAdministrativeAuthority != AddressZero) await removeProjectFromUser(previousAdministrativeAuthority.toLowerCase(), projectAddress);
    await projectContract.changeAdministrativeAuthority(administrativeAuthorityAddress);
  } catch (error: any) {
    console.log(error);
    throw new Error(getErrorReason(error));
  }

  try {
    await prisma.user.update({
      where: { walletAddress: administrativeAuthorityAddress },
      data: {
        projectAddresses: {
          push: projectAddress,
        },
      },
    });
  } catch (e: any) {
    throw e;
  }
};

export const finalizeDPPPhase = async (projectAddress: string, signerAddress: string) => {
    try {
        const projectContract = new Contract(projectAddress, getContractArtifact(ArtifactType.PROJECT_ARTIFACT).abi, await provider.getSigner(signerAddress));
        await projectContract.finalizeDPPPhase();

        await prisma.project.update({
            where: {
                smartContractAddress: projectAddress,
            },
            data: {
                projectState: ProjectState.AQUIRING_PROJECT_OPINIONS,
            },
        });
    } catch (error: any) {
        throw new Error(getErrorReason(error));
    }
};

const getProjectAddressesOfUser = async (walletAddress: string) => {
    try {
        return await prisma.user.findUnique({
            where: {
                walletAddress: walletAddress,
            },
        });
    } catch (error: any) {
        throw new Error(error.message);
    }
};

const getDocumentContractModels = async (addresses: string[]) => {
    let sentDocumentContracts: DocumentContractModel[] = [];
    for (const address of addresses) {
        const documentContract = new Contract(address, getContractArtifact(ArtifactType.DOCUMENT_CONTRACT_ARTIFACT).abi, provider);

        const assessmentProvider: User | null = await findUserByAddress(await documentContract.assessmentProvider());

        if (!assessmentProvider) throw new Error("Assessment provider not found");

        let requestedAssessmentDueDate: number | null = parseInt(await documentContract.requestedAssessmentDueDate());
        if (requestedAssessmentDueDate == 0) requestedAssessmentDueDate = null;

        let mainDocumentType: MainDocumentType = parseInt(await documentContract.mainDocumentType()) == 0
            ? MainDocumentType.DPP : MainDocumentType.DGD;

        let assessmentDateProvided: number | null = parseInt((await documentContract.assessment()).dateProvided);
        if (assessmentDateProvided == 0) assessmentDateProvided = null;

        sentDocumentContracts.push({
            documentContractAddress: address,
            assessmentProvider: assessmentProvider,
            isClosed: await documentContract.isClosed(),
            assessmentDueDate: parseInt(await documentContract.assessmentDueDate()),
            mainDocumentUpdateRequested: await documentContract.mainDocumentUpdateRequested(),
            requestedAssessmentDueDate: requestedAssessmentDueDate,
            attachments: getAttachmentsUrls(await documentContract.getAttachments()),
            assessmentAttachments: getAttachmentsUrls(await documentContract.getAssessmentAttachments()),
            assessmentMainDocument: (await documentContract.assessment()).assessmentMainDocument.id,
            mainDocumentType: mainDocumentType,
            assessmentDateProvided: assessmentDateProvided,
            dateCreated: parseInt(await documentContract.dateCreated())
        });
    }

    return sentDocumentContracts;
};

const getAttachmentsUrls = (attachments: { id: string }[]) => {
    return attachments.map((attachment) => attachment.id);
};

export const removeProjectFromUser = async (walletAddress: string, projectAddress: string) => {
  try {
    const {projectAddresses}: string[] = await prisma.user.findUnique({
      where: {
        walletAddress: walletAddress
      },
      select: {
        projectAddresses: true
      }
    });

    await prisma.user.update({
      where: {
        walletAddress: walletAddress
      },
      data: {
        projectAddresses: {
          set: projectAddresses.filter((address) => address != projectAddress),
        }
      }
    });
  } catch (e: any) {
    throw e;
  }
}