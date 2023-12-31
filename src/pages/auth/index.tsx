import {MetaMaskConnector} from "wagmi/connectors/metaMask";
import {signIn, useSession} from "next-auth/react";
import {useAccount, useConnect, useSignMessage, useDisconnect} from "wagmi";
import {useRouter} from "next/router";
import {useAuthRequestChallengeEvm} from "@moralisweb3/next";
import {useEffect, useState} from "react";
import {LoadingAnimation} from "@/components/generic/loading-animation/LoadingAnimation";
import useAlert from "@/hooks/AlertHook";

function SignIn() {
    const [isLoading, setIsLoading] = useState(false);
    const {data: session, status} = useSession();
    const {connectAsync} = useConnect();
    const {disconnectAsync} = useDisconnect();
    const {isConnected} = useAccount();
    const {signMessageAsync} = useSignMessage();
    const {requestChallengeAsync} = useAuthRequestChallengeEvm();
    const {push} = useRouter();
    const {setAlert} = useAlert();

    useEffect(() => {
        if (status === "authenticated" && session) {
            push("/dashboard");
        }
    }, [status, session, push]);

    const handleAuth = async () => {
        if (isConnected) {
            await disconnectAsync();
        }

        const {account, chain} = await connectAsync({
            connector: new MetaMaskConnector(),
        });

       /* const response = await fetch("/api/auth/blockchainAuthorization", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                account: account
            })
        });

        if (!response.ok) {
            setAlert({title: '', message: 'You are not registered on this platform.', type: 'error'});
            return;
        }*/
        // @ts-ignore
        const {message} = await requestChallengeAsync({
            address: account,
            chainId: chain.id,
        });

        const signature = await signMessageAsync({message});
        setIsLoading(true);
        // @ts-ignore
        const {url} = await signIn("moralis-auth", {
            message,
            signature,
            redirect: false,
            callbackUrl: "/dashboard",
        });
        await push(url);
        setIsLoading(false);
    };

    return (
        <>
            {isLoading ? <LoadingAnimation/> : null}
            <div className="flex flex-col items-center justify-center h-full ">
                <img src="/images/metamask-logo.png" alt="Metamask Logo" className="w-500 h-300 mb-4"/>
                <h1 className="text-4xl font-semibold mb-4 pt-10 text-black">Login with Metamask</h1>
                <p className="text-gray-500 mb-8">Please connect a wallet.</p>
                <button className="py-3 px-6 bg-orange-400 hover:bg-orange-500 text-white rounded-3xl font-medium"
                        onClick={handleAuth}>
                    Connect Wallet
                </button>
            </div>
        </>
    );
}

export default SignIn;
